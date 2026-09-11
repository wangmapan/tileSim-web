"""Official TileSim Web desktop launcher.

The launcher intentionally uses only Python's standard library. Long-running
health checks, builds, and PowerShell commands never execute on Tk's UI thread.
"""

from __future__ import annotations

from collections import deque
import json
import os
import queue
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
from typing import Any, Callable


def resolve_web_root() -> Path:
    """Locate the frontend checkout in source and frozen launcher modes."""
    source_checkout = Path(__file__).resolve().parents[2]
    executable_checkout = Path(sys.executable).resolve().parent
    configured_text = os.environ.get("TILESIM_WEB_ROOT", "").strip()
    configured = Path(configured_text) if configured_text else None
    frozen = getattr(sys, "frozen", False)
    ordered_candidates = (
        (configured, executable_checkout, source_checkout)
        if frozen
        else (source_checkout, configured)
    )
    candidates = tuple(
        candidate
        for candidate in ordered_candidates
        if candidate is not None
    )
    for candidate in candidates:
        if (candidate / "scripts" / "start-workbench.ps1").is_file():
            return candidate.resolve()
    return candidates[0].resolve()


WEB_ROOT = resolve_web_root()
RUNTIME_ROOT = WEB_ROOT / "runtime"
MANIFEST_PATH = RUNTIME_ROOT / "backend-current.json"
MODEL_CONFIG_PATH = RUNTIME_ROOT / "evidence-agent.local.json"
START_SCRIPT = WEB_ROOT / "scripts" / "start-workbench.ps1"
UPDATE_SCRIPT = WEB_ROOT / "scripts" / "update-backend.ps1"
CONFIGURE_MODEL_SCRIPT = WEB_ROOT / "scripts" / "configure-evidence-agent.ps1"
REPAIR_WSL_SCRIPT = WEB_ROOT / "scripts" / "request-wsl-repair.ps1"
DEFAULT_BACKEND_ROOT = WEB_ROOT.parent / "tileSim"
DEFAULT_DEPLOYMENT_ROOT = WEB_ROOT.parent / "tileSim-backend"
DEFAULT_WSL_DISTRO = "Ubuntu-24.04"
WEB_URL = "http://127.0.0.1:5173/"
HEALTH_URL = "http://127.0.0.1:5173/api/health"
HEALTH_TIMEOUT_SECONDS = 35

BG = "#f3f5f8"
CARD = "#ffffff"
TEXT = "#172033"
MUTED = "#667085"
LINE = "#d8dee8"
BLUE = "#245edb"
BLUE_DARK = "#1949b8"
GREEN = "#137a3d"
AMBER = "#9a5b00"
RED = "#b42318"


def resolve_bundled_node() -> Path | None:
    """Return the Node runtime embedded in a frozen launcher, if present."""
    if not getattr(sys, "frozen", False):
        return None
    extraction_root = getattr(sys, "_MEIPASS", None)
    if not extraction_root:
        return None
    candidate = Path(extraction_root) / "node.exe"
    return candidate.resolve() if candidate.is_file() else None


def powershell_environment() -> dict[str, str]:
    """Provide deployment scripts with the launcher's private Node runtime."""
    environment = os.environ.copy()
    node = resolve_bundled_node()
    if node is not None:
        environment["TILESIM_NODE"] = str(node)
        existing_path = environment.get("PATH", "")
        environment["PATH"] = os.pathsep.join(
            item for item in (str(node.parent), existing_path) if item
        )
    return environment


def load_json_object(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8-sig") as stream:
            value = json.load(stream)
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        return {}


def load_public_model_settings() -> dict[str, Any]:
    """Read only non-secret settings and the presence of a protected key."""
    config = load_json_object(MODEL_CONFIG_PATH)
    if not config:
        return {"configured": False}
    base_url = config.get("base_url") or config.get("TILESIM_EVIDENCE_AGENT_ENDPOINT")
    model = config.get("model") or config.get("TILESIM_EVIDENCE_AGENT_MODEL")
    timeout_ms = config.get("timeout_ms") or config.get("TILESIM_EVIDENCE_AGENT_TIMEOUT_MS")
    protected_key = config.get("api_key_dpapi") or config.get(
        "TILESIM_EVIDENCE_AGENT_API_KEY_DPAPI"
    )
    return {
        "configured": bool(base_url and model and protected_key),
        "base_url": str(base_url or ""),
        "model": str(model or ""),
        "timeout_ms": str(timeout_ms or "30000"),
        "protected_key_present": bool(protected_key),
    }


def fetch_health() -> dict[str, Any] | None:
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=HEALTH_TIMEOUT_SECONDS) as response:
            value = json.load(response)
        return value if response.status == 200 and isinstance(value, dict) else None
    except (OSError, ValueError, urllib.error.URLError):
        return None


def short_revision(value: object) -> str:
    text = str(value or "").strip()
    return text[:12] if text else "—"


def friendly_failure_detail(output: str) -> str:
    lines = [line.strip() for line in output.splitlines() if line.strip()]
    lowered = output.lower()
    if "tilesim_wsl_service_pending_delete" in lowered:
        return (
            "Windows Installer 已将旧的 WSL Service 标记为待删除。请先重启 Windows，"
            f"再以管理员身份运行 {WEB_ROOT / 'scripts' / 'repair-wsl-service.ps1'}。"
        )
    if "tilesim_wsl_service_disabled" in lowered:
        return (
            "Windows 的 WSL Service 当前被禁用，TileSim 后端无法启动。\n\n"
            "请以管理员身份打开 PowerShell，执行：\n"
            "Set-Service -Name WslService -StartupType Manual\n"
            "Start-Service -Name WslService\n\n"
            "完成后重新点击“启动 / 重启并打开”。"
        )
    if "tilesim_wsl_not_installed" in lowered:
        return "当前电脑没有可用的 WSL。请先安装或修复 Windows Subsystem for Linux。"
    if "tilesim_wsl_repair_cancelled" in lowered:
        return "修复 WSL 需要 Windows 管理员授权，本次操作已取消。"
    if "wsl/callmsi/install/error_install_failure" in lowered or (
        "wsl service" in lowered and "could not be installed" in lowered
    ):
        return (
            "WSL 正在尝试修复系统服务，但安装失败。请以管理员身份运行一次 `wsl --status` "
            "完成修复，然后重新启动 TileSim 工作台。"
        )
    if "another backend" in lowered and "already running" in lowered:
        return "另一个部署任务仍在运行，请等待其完成后再试。"
    if "local changes; update aborted" in lowered:
        return "部署目录存在未提交修改，为避免覆盖数据已停止。\n\n" + "\n".join(lines[-8:])
    if "cannot be decrypted" in lowered:
        return "保存的 API Key 不属于当前 Windows 用户或当前电脑，请重新保存模型设置。"
    if "authenticated capability probe" in lowered:
        return "模型服务配置已加载，但认证或结构化输出探测未通过。请检查 Base URL、API Key 和模型名。"
    if "no deployment manifest" in lowered:
        return "尚无可启动的部署。请先点击“更新并部署最新 main”。"
    return "\n".join(lines[-18:]) or "脚本没有返回可用的错误详情。"


class TileSimLauncher(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("TileSim 工作台")
        self.geometry("900x780")
        self.minsize(820, 720)
        self.configure(bg=BG)
        self.option_add("*Font", ("Microsoft YaHei UI", 9))
        self.protocol("WM_DELETE_WINDOW", self._on_close)

        self.operation_active = False
        self.events: queue.Queue[tuple[Any, ...]] = queue.Queue()

        self.service_text = tk.StringVar(value="正在检查…")
        self.identity_text = tk.StringVar(value="—")
        self.revision_text = tk.StringVar(value="—")
        self.validation_text = tk.StringVar(value="—")
        self.model_status_text = tk.StringVar(value="尚未配置")
        self.operation_text = tk.StringVar(value="准备就绪")

        self.base_url_text = tk.StringVar()
        self.model_text = tk.StringVar(value="gpt-5.6-sol")
        self.api_key_text = tk.StringVar()
        self.timeout_text = tk.StringVar(value="30000")
        self.backend_root_text = tk.StringVar(value=str(DEFAULT_BACKEND_ROOT))
        self.wsl_distro_text = tk.StringVar(value=DEFAULT_WSL_DISTRO)
        self.saved_key_present = False

        self._configure_styles()
        self._build_ui()
        self._load_model_form()
        self.after(100, self._drain_events)
        self.after(180, self.refresh_status)

    def _configure_styles(self) -> None:
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure(
            "TileSim.Horizontal.TProgressbar",
            troughcolor="#e4e8ef",
            background=BLUE,
            bordercolor="#e4e8ef",
            lightcolor=BLUE,
            darkcolor=BLUE,
        )
        style.configure("TileSim.TCombobox", padding=5)

    def _build_ui(self) -> None:
        canvas = tk.Canvas(self, bg=BG, highlightthickness=0)
        scrollbar = ttk.Scrollbar(self, orient="vertical", command=canvas.yview)
        content = tk.Frame(canvas, bg=BG)
        content.bind(
            "<Configure>", lambda _event: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        window_id = canvas.create_window((0, 0), window=content, anchor="nw")
        canvas.bind("<Configure>", lambda event: canvas.itemconfigure(window_id, width=event.width))
        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        outer = tk.Frame(content, bg=BG)
        outer.pack(fill="both", expand=True, padx=30, pady=(24, 28))

        tk.Label(
            outer,
            text="TileSim 模拟工作台",
            font=("Microsoft YaHei UI", 21, "bold"),
            fg=TEXT,
            bg=BG,
        ).pack(anchor="w")
        tk.Label(
            outer,
            text="本地部署、模型服务配置与运行状态",
            fg=MUTED,
            bg=BG,
        ).pack(anchor="w", pady=(3, 14))

        status_card = self._card(outer, "运行状态")
        self.service_label = self._status_badge(status_card, self.service_text)
        self._status_row(status_card, 1, "部署身份", self.identity_text)
        self._status_row(status_card, 2, "源码 / CLI", self.revision_text, mono=True)
        self._status_row(status_card, 3, "最近验证", self.validation_text)
        self._status_row(status_card, 4, "模型服务", self.model_status_text)
        tk.Frame(status_card, bg=CARD, height=10).grid(row=5, column=0, columnspan=3)

        model_card = self._card(outer, "大模型服务设置", top=12)
        tk.Label(
            model_card,
            text="OpenAI 兼容接口；API Key 使用 Windows DPAPI 加密，仅当前用户和当前电脑可解密。",
            fg=MUTED,
            bg=CARD,
        ).grid(row=1, column=0, columnspan=3, sticky="w", padx=18, pady=(0, 10))
        self.base_url_entry = self._form_row(
            model_card, 2, "Base URL *", self.base_url_text, "例如 https://api.example.com/v1"
        )
        self.model_entry = self._form_row(
            model_card, 3, "模型名 *", self.model_text, "必须与服务返回的 model 完全一致"
        )
        self.api_key_entry = self._form_row(
            model_card,
            4,
            "API Key *",
            self.api_key_text,
            "留空表示保留已保存的 Key",
            secret=True,
        )

        tk.Label(model_card, text="超时", fg=MUTED, bg=CARD).grid(
            row=5, column=0, sticky="w", padx=(18, 10), pady=6
        )
        self.timeout_box = ttk.Combobox(
            model_card,
            textvariable=self.timeout_text,
            values=("30000", "60000", "120000"),
            state="readonly",
            style="TileSim.TCombobox",
            width=18,
        )
        self.timeout_box.grid(row=5, column=1, sticky="w", pady=6)
        tk.Label(model_card, text="毫秒", fg=MUTED, bg=CARD).grid(
            row=5, column=2, sticky="w", padx=(8, 18), pady=6
        )
        self.save_model_button = self._button(
            model_card,
            "保存模型设置",
            self.save_model_settings,
            primary=False,
        )
        self.save_model_button.grid(
            row=6, column=0, columnspan=3, sticky="ew", padx=18, pady=(8, 16), ipady=7
        )

        deploy_card = self._card(outer, "部署设置", top=12)
        tk.Label(
            deploy_card,
            text=(
                "仅在需要更新版本时拉取并部署后端最新 origin/main；日常使用直接启动工作台。"
                "部署会在独立工作树中完成构建和验证，不会切换日常开发目录。"
            ),
            fg=MUTED,
            bg=CARD,
            wraplength=790,
            justify="left",
        ).grid(row=1, column=0, columnspan=4, sticky="w", padx=18, pady=(0, 10))
        self.backend_entry = self._form_row(
            deploy_card, 2, "后端仓库目录 *", self.backend_root_text, f"默认 {DEFAULT_BACKEND_ROOT}"
        )
        self.browse_button = self._button(deploy_card, "选择…", self.choose_backend_root, primary=False)
        self.browse_button.grid(row=2, column=3, sticky="e", padx=(8, 18), pady=6, ipady=3)
        self.wsl_entry = self._form_row(
            deploy_card, 3, "WSL 发行版 *", self.wsl_distro_text, "默认 Ubuntu-24.04"
        )
        deploy_actions = tk.Frame(deploy_card, bg=CARD)
        deploy_actions.grid(row=4, column=0, columnspan=4, sticky="ew", padx=18, pady=(8, 16))
        self.deploy_button = self._button(
            deploy_actions,
            "更新并部署最新 main",
            self.update_main_deployment,
            primary=False,
        )
        self.deploy_button.pack(side="left", fill="x", expand=True, ipady=7)
        self.repair_wsl_button = self._button(
            deploy_actions,
            "修复 WSL",
            self.repair_wsl,
            primary=False,
        )
        self.repair_wsl_button.pack(side="left", padx=(9, 0), ipady=7)

        action_bar = tk.Frame(outer, bg=BG)
        action_bar.pack(fill="x", pady=(14, 0))
        self.start_button = self._button(
            action_bar, "启动 / 重启并打开", self.start_and_open, primary=True
        )
        self.start_button.pack(side="left", fill="x", expand=True, ipady=10)
        self.open_button = self._button(
            action_bar, "只打开网页", lambda: webbrowser.open(WEB_URL), primary=False
        )
        self.open_button.pack(side="left", padx=(9, 0), ipady=10)
        self.refresh_button = self._button(
            action_bar, "刷新状态", self.refresh_status, primary=False
        )
        self.refresh_button.pack(side="left", padx=(9, 0), ipady=10)

        self.progress = ttk.Progressbar(
            outer, mode="indeterminate", style="TileSim.Horizontal.TProgressbar"
        )
        self.progress.pack(fill="x", pady=(15, 0))
        tk.Label(
            outer,
            textvariable=self.operation_text,
            anchor="w",
            justify="left",
            fg=MUTED,
            bg=BG,
            wraplength=820,
        ).pack(fill="x", pady=(7, 0))

    @staticmethod
    def _card(parent: tk.Widget, title: str, *, top: int = 0) -> tk.Frame:
        card = tk.Frame(parent, bg=CARD, highlightthickness=1, highlightbackground=LINE)
        card.pack(fill="x", pady=(top, 0))
        card.columnconfigure(1, weight=1)
        tk.Label(
            card,
            text=title,
            font=("Microsoft YaHei UI", 11, "bold"),
            fg=TEXT,
            bg=CARD,
        ).grid(row=0, column=0, columnspan=3, sticky="w", padx=18, pady=(14, 8))
        return card

    def _status_badge(self, parent: tk.Widget, variable: tk.StringVar) -> tk.Label:
        label = tk.Label(
            parent,
            textvariable=variable,
            font=("Microsoft YaHei UI", 9, "bold"),
            fg=AMBER,
            bg="#fff7e8",
            padx=10,
            pady=4,
        )
        label.grid(row=0, column=2, sticky="e", padx=18, pady=(11, 7))
        return label

    @staticmethod
    def _status_row(
        parent: tk.Widget, row: int, title: str, variable: tk.StringVar, *, mono: bool = False
    ) -> None:
        tk.Label(parent, text=title, fg=MUTED, bg=CARD).grid(
            row=row, column=0, sticky="nw", padx=(18, 10), pady=4
        )
        tk.Label(
            parent,
            textvariable=variable,
            fg=TEXT,
            bg=CARD,
            anchor="w",
            justify="left",
            font=("Consolas", 9) if mono else ("Microsoft YaHei UI", 9),
        ).grid(row=row, column=1, columnspan=2, sticky="ew", padx=(0, 18), pady=4)

    @staticmethod
    def _form_row(
        parent: tk.Widget,
        row: int,
        title: str,
        variable: tk.StringVar,
        hint: str,
        *,
        secret: bool = False,
    ) -> tk.Entry:
        tk.Label(parent, text=title, fg=MUTED, bg=CARD).grid(
            row=row, column=0, sticky="w", padx=(18, 10), pady=6
        )
        entry = tk.Entry(
            parent,
            textvariable=variable,
            show="●" if secret else "",
            relief="solid",
            bd=1,
            highlightthickness=0,
            fg=TEXT,
            bg="white",
        )
        entry.grid(row=row, column=1, columnspan=2, sticky="ew", pady=6, ipady=6)
        tk.Label(parent, text=hint, fg=MUTED, bg=CARD).grid(
            row=row, column=3, sticky="w", padx=(10, 18), pady=6
        )
        parent.columnconfigure(2, weight=1)
        return entry

    @staticmethod
    def _button(
        parent: tk.Widget, text: str, command: Callable[[], None], *, primary: bool
    ) -> tk.Button:
        return tk.Button(
            parent,
            text=text,
            command=command,
            font=("Microsoft YaHei UI", 9, "bold") if primary else ("Microsoft YaHei UI", 9),
            bg=BLUE if primary else CARD,
            fg="white" if primary else TEXT,
            activebackground=BLUE_DARK if primary else "#edf1f6",
            activeforeground="white" if primary else TEXT,
            relief="flat",
            bd=0,
            cursor="hand2",
            padx=16,
        )

    def _load_model_form(self) -> None:
        settings = load_public_model_settings()
        self.saved_key_present = bool(settings.get("protected_key_present"))
        if settings.get("base_url"):
            self.base_url_text.set(str(settings["base_url"]))
        if settings.get("model"):
            self.model_text.set(str(settings["model"]))
        if settings.get("timeout_ms") in {"30000", "60000", "120000"}:
            self.timeout_text.set(str(settings["timeout_ms"]))
        self.api_key_text.set("")
        if settings.get("configured"):
            self.model_status_text.set(f"已安全保存 · {settings.get('model')} · 重启后生效")
        else:
            self.model_status_text.set("尚未完成 Base URL、模型名和 API Key 配置")

    def _drain_events(self) -> None:
        latest_progress: str | None = None
        try:
            while True:
                event = self.events.get_nowait()
                kind = event[0]
                if kind == "progress":
                    latest_progress = str(event[1])
                elif kind == "refresh":
                    self._finish_refresh(event[1], event[2])
                elif kind == "success":
                    self._finish_operation_success(str(event[1]), bool(event[2]), bool(event[3]))
                elif kind == "failure":
                    self._finish_operation_failure(str(event[1]), str(event[2]))
        except queue.Empty:
            pass
        if latest_progress:
            self.operation_text.set(latest_progress)
        self.after(100, self._drain_events)

    def _set_badge(self, text: str, state: str) -> None:
        palette = {
            "good": (GREEN, "#eaf7ee"),
            "warn": (AMBER, "#fff7e8"),
            "bad": (RED, "#fff0ee"),
        }
        foreground, background = palette[state]
        self.service_text.set(text)
        self.service_label.configure(fg=foreground, bg=background)

    def _apply_snapshot(self, manifest: dict[str, Any], health: dict[str, Any] | None) -> None:
        live = health or {}
        deployment = live.get("deployment_ref") or manifest.get("source_ref") or "尚未部署"
        mode = live.get("deployment_mode") or manifest.get("deployment_mode") or "—"
        source = live.get("source_revision") or manifest.get("source_revision")
        build = live.get("build_revision") or manifest.get("build_revision")
        self.identity_text.set(f"{deployment} · {mode}")
        self.revision_text.set(f"{short_revision(source)} / {short_revision(build)}")

        validation = manifest.get("validation")
        validation = validation if isinstance(validation, dict) else {}
        parts = []
        if validation.get("tilesim_ctest"):
            parts.append(f"CTest {validation['tilesim_ctest']}")
        if validation.get("web"):
            parts.append(f"Web {validation['web']}")
        self.validation_text.set(" · ".join(parts) or "尚无验证记录")

        if health is None:
            self._set_badge("服务未启动", "warn")
            if not self.operation_active:
                self.operation_text.set("可直接启动已有部署；没有部署清单时先执行本地部署。")
            return
        if health.get("execution_ready") is True and health.get("versions_match") is True:
            self._set_badge("服务已就绪", "good")
            if not self.operation_active:
                self.operation_text.set("服务可执行。模型设置会在下一次启动或重启时加载。")
        else:
            self._set_badge("在线但不可执行", "bad")
            if not self.operation_active:
                self.operation_text.set("部署身份不一致或验证失败，请重新部署当前本地版本。")

    def refresh_status(self) -> None:
        if self.operation_active:
            return
        self.refresh_button.configure(state="disabled")
        self.operation_text.set("正在后台读取部署清单并检查本地服务…")

        def worker() -> None:
            self.events.put(("refresh", load_json_object(MANIFEST_PATH), fetch_health()))

        threading.Thread(target=worker, daemon=True, name="tilesim-status").start()

    def _finish_refresh(self, manifest: dict[str, Any], health: dict[str, Any] | None) -> None:
        self._load_model_form()
        self._apply_snapshot(manifest, health)
        if not self.operation_active:
            self.refresh_button.configure(state="normal")

    def _set_operation(self, active: bool, text: str) -> None:
        self.operation_active = active
        self.operation_text.set(text)
        state = "disabled" if active else "normal"
        for widget in (
            self.start_button,
            self.deploy_button,
            self.repair_wsl_button,
            self.save_model_button,
            self.refresh_button,
            self.browse_button,
            self.base_url_entry,
            self.model_entry,
            self.api_key_entry,
            self.backend_entry,
            self.wsl_entry,
        ):
            widget.configure(state=state)
        self.timeout_box.configure(state="disabled" if active else "readonly")
        if active:
            self.progress.start(10)
        else:
            self.progress.stop()

    @staticmethod
    def _powershell_command(script: Path, *arguments: str) -> list[str]:
        return [
            "powershell.exe",
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(script),
            *arguments,
        ]

    def _run_powershell(
        self, script: Path, *arguments: str, stdin_text: str | None = None
    ) -> tuple[int, str]:
        creation_flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        process = subprocess.Popen(
            self._powershell_command(script, *arguments),
            cwd=WEB_ROOT,
            env=powershell_environment(),
            stdin=subprocess.PIPE if stdin_text is not None else subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="mbcs",
            errors="replace",
            creationflags=creation_flags,
        )
        if stdin_text is not None and process.stdin is not None:
            process.stdin.write(stdin_text + "\n")
            process.stdin.close()

        # Deployment tools can print thousands of build lines. Only the tail
        # is needed for a useful error dialog, so keep memory usage bounded.
        output: deque[str] = deque(maxlen=400)
        last_progress_at = 0.0
        pending_progress = ""
        if process.stdout is not None:
            for raw_line in process.stdout:
                if raw_line.count("\x00") >= 3:
                    continue
                line = raw_line.strip()
                if not line:
                    continue
                output.append(line[-4000:])
                compact = line if len(line) <= 120 else f"…{line[-119:]}"
                pending_progress = compact
                now = time.monotonic()
                if now - last_progress_at >= 0.2:
                    self.events.put(("progress", pending_progress))
                    last_progress_at = now
                    pending_progress = ""
        if pending_progress:
            self.events.put(("progress", pending_progress))
        return process.wait(), "\n".join(output)

    def _run_script_operation(
        self,
        title: str,
        script: Path,
        arguments: tuple[str, ...],
        *,
        stdin_text: str | None = None,
        open_after: bool = False,
        reload_model: bool = False,
    ) -> None:
        if self.operation_active:
            return
        if not script.is_file():
            messagebox.showerror("TileSim 工作台", f"未找到脚本：\n{script}")
            return
        self._set_operation(True, title)

        def worker() -> None:
            try:
                code, output = self._run_powershell(script, *arguments, stdin_text=stdin_text)
                if code == 0:
                    self.events.put(("success", title, open_after, reload_model))
                else:
                    self.events.put(("failure", title, friendly_failure_detail(output)))
            except (OSError, subprocess.SubprocessError) as error:
                self.events.put(("failure", title, f"无法启动后台脚本：{error}"))

        threading.Thread(target=worker, daemon=True, name="tilesim-operation").start()

    def save_model_settings(self) -> None:
        base_url = self.base_url_text.get().strip()
        model = self.model_text.get().strip()
        api_key = self.api_key_text.get().strip()
        timeout = self.timeout_text.get().strip()
        if not base_url or not model:
            messagebox.showerror("模型设置", "Base URL 和模型名是必填项。")
            return
        if not api_key and not self.saved_key_present:
            messagebox.showerror("模型设置", "首次配置必须填写 API Key。")
            return
        arguments = (
            "-Action",
            "Set",
            "-ConfigPath",
            str(MODEL_CONFIG_PATH),
            "-BaseUrl",
            base_url,
            "-Model",
            model,
            "-TimeoutMs",
            timeout,
        )
        if api_key:
            arguments += ("-ApiKeyFromStdin",)
            stdin_text = api_key
            self.api_key_text.set("")
        else:
            arguments += ("-KeepExistingKey",)
            stdin_text = None
        self._run_script_operation(
            "正在安全保存模型设置…",
            CONFIGURE_MODEL_SCRIPT,
            arguments,
            stdin_text=stdin_text,
            reload_model=True,
        )

    def choose_backend_root(self) -> None:
        selected = filedialog.askdirectory(
            title="选择 TileSim 后端仓库目录", initialdir=self.backend_root_text.get()
        )
        if selected:
            self.backend_root_text.set(selected)

    def start_and_open(self) -> None:
        self._run_script_operation(
            "正在后台验证部署并启动工作台…",
            START_SCRIPT,
            ("-WslDistro", self.wsl_distro_text.get().strip() or DEFAULT_WSL_DISTRO),
            open_after=True,
        )

    def repair_wsl(self) -> None:
        self._run_script_operation(
            "正在请求管理员权限并修复 WSL…",
            REPAIR_WSL_SCRIPT,
            ("-WslDistro", self.wsl_distro_text.get().strip() or DEFAULT_WSL_DISTRO),
        )

    def update_main_deployment(self) -> None:
        backend_root_text = self.backend_root_text.get().strip()
        if not backend_root_text:
            messagebox.showerror("部署设置", "后端仓库目录是必填项。")
            return
        backend_root = Path(backend_root_text)
        if not backend_root.is_dir():
            messagebox.showerror("部署设置", f"后端仓库目录不存在：\n{backend_root}")
            return
        if not messagebox.askyesno(
            "确认更新 main 部署",
            "该操作会拉取后端最新 origin/main，在独立部署工作树中重新构建 TileSim、"
            "运行验证、生成不可变 Web 快照并重启服务。\n"
            "日常开发目录不会被切换；过程可能需要数分钟，但界面不会冻结。是否继续？",
        ):
            return
        self._run_script_operation(
            "正在更新并部署最新 main…",
            UPDATE_SCRIPT,
            (
                "-RepositoryRoot",
                str(backend_root),
                "-BackendRoot",
                str(DEFAULT_DEPLOYMENT_ROOT),
                "-WslDistro",
                self.wsl_distro_text.get().strip() or DEFAULT_WSL_DISTRO,
            ),
        )

    def _finish_operation_success(self, title: str, open_after: bool, reload_model: bool) -> None:
        if reload_model:
            self._load_model_form()
        self._set_operation(False, f"{title.removesuffix('…')}完成。")
        if open_after:
            webbrowser.open(WEB_URL)
        self.refresh_status()

    def _finish_operation_failure(self, title: str, detail: str) -> None:
        self._set_operation(False, f"{title.removesuffix('…')}失败。")
        messagebox.showerror("TileSim 工作台", f"{title.removesuffix('…')}失败\n\n{detail}")
        self.refresh_status()

    def _on_close(self) -> None:
        if self.operation_active:
            messagebox.showwarning(
                "操作仍在进行",
                "构建、部署或启动仍在后台运行。请等待操作完成后再关闭，避免留下难以判断的中间状态。",
            )
            return
        self.destroy()


def check_environment(output_path: Path | None = None) -> int:
    required_files = (START_SCRIPT, UPDATE_SCRIPT, CONFIGURE_MODEL_SCRIPT, REPAIR_WSL_SCRIPT)
    missing = [str(path) for path in required_files if not path.is_file()]
    bundled_node = resolve_bundled_node()
    result = {
        "schema_version": "tilesim.workbench_launcher_check.v1",
        "ready": not missing,
        "web_root": str(WEB_ROOT),
        "bundled_node_runtime": bundled_node is not None,
        "deployment_manifest_present": MANIFEST_PATH.is_file(),
        "model_settings_configured": bool(load_public_model_settings().get("configured")),
        "missing_files": missing,
    }
    serialized = json.dumps(result, ensure_ascii=False)
    if output_path is not None:
        output_path.write_text(serialized + "\n", encoding="utf-8")
    elif sys.stdout is not None:
        print(serialized)
    return 0 if not missing else 1


def main() -> int:
    arguments = sys.argv[1:]
    if "--check-file" in arguments:
        index = arguments.index("--check-file")
        if index + 1 >= len(arguments):
            return 2
        return check_environment(Path(arguments[index + 1]))
    if "--check" in arguments:
        return check_environment()
    try:
        TileSimLauncher().mainloop()
    except Exception as error:  # noqa: BLE001 - GUI entry point must fail visibly.
        fallback = tk.Tk()
        fallback.withdraw()
        messagebox.showerror("TileSim 工作台", f"启动器无法启动：\n\n{error}")
        fallback.destroy()
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
