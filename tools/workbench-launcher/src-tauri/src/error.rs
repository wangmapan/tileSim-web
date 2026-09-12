use regex::Regex;
use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicError {
    pub category: String,
    pub action: String,
    pub technical_detail: String,
}

impl PublicError {
    pub fn new(category: &str, action: &str, detail: impl AsRef<str>) -> Self {
        Self {
            category: category.to_owned(),
            action: action.to_owned(),
            technical_detail: redact(detail.as_ref()),
        }
    }

    pub fn blocked(detail: impl AsRef<str>) -> Self {
        Self::new("操作已阻止", "等待当前任务完成后再试。", detail)
    }
}

pub fn classify_failure(output: &str) -> PublicError {
    let lowered = output.to_ascii_lowercase();
    if lowered.contains("tilesim_wsl_service_disabled") {
        return PublicError::new(
            "WSL 服务已禁用",
            "打开“环境诊断”，选择“修复 WSL”，授权完成后重新启动。",
            output,
        );
    }
    if lowered.contains("tilesim_wsl_not_installed") {
        return PublicError::new(
            "WSL 不可用",
            "先安装 WSL2 与 Ubuntu-24.04，再刷新环境诊断。",
            output,
        );
    }
    if lowered.contains("cannot be decrypted") {
        return PublicError::new(
            "模型密钥不可解密",
            "使用当前 Windows 用户重新保存 API Key。",
            output,
        );
    }
    if lowered.contains("local changes; update aborted") {
        return PublicError::new(
            "部署工作树包含本地修改",
            "检查部署目录并保留这些修改；清理方案由你决定，然后再重试部署。",
            output,
        );
    }
    if lowered.contains("another backend update") || lowered.contains("already running") {
        return PublicError::blocked(output);
    }
    if lowered.contains("no deployment manifest") {
        return PublicError::new(
            "尚无可启动部署",
            "前往“更新与部署”，完成一次验证部署。",
            output,
        );
    }
    let detail = if output.trim().is_empty() {
        "PowerShell exited without readable output. Open the operation log and retry after refreshing the environment status."
    } else {
        output
    };
    PublicError::new(
        "本地操作失败",
        "展开技术详情，按最后一条可执行提示修复后重试。",
        detail,
    )
}

pub fn redact(value: &str) -> String {
    let credential = Regex::new(
        r"(?i)((?:api[_-]?key|authorization|token|secret|password)\s*[:=]\s*)(?:bearer\s+)?([^\s,;]+)",
    )
    .expect("credential regex");
    let windows_path = Regex::new(r#"(?i)\b[a-z]:\\[^\r\n\t"']+"#).expect("windows path regex");
    let wsl_path = Regex::new(r"/mnt/[a-z]/[^\s\r\n]+").expect("WSL path regex");
    let redacted = credential.replace_all(value, "$1<redacted>");
    let redacted = windows_path.replace_all(&redacted, "<path>");
    wsl_path
        .replace_all(&redacted, "<path>")
        .chars()
        .filter(|character| *character != '\0')
        .collect::<String>()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_credentials_and_paths() {
        let value = "Authorization: Bearer abc API_KEY=top-secret C:\\Users\\person\\repo";
        let redacted = redact(value);
        assert!(!redacted.contains("abc"));
        assert!(!redacted.contains("top-secret"));
        assert!(!redacted.contains("person"));
        assert!(redacted.contains("<redacted>"));
        assert!(redacted.contains("<path>"));
    }

    #[test]
    fn generic_failure_never_has_empty_technical_detail() {
        let error = classify_failure("");
        assert_eq!(error.category, "本地操作失败");
        assert!(!error.technical_detail.trim().is_empty());
    }
}
