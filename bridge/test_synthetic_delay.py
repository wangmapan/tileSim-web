import os
import subprocess
import sys
import time
import unittest
from unittest.mock import patch

from services import execution


class SyntheticDelayTests(unittest.TestCase):
    def test_delay_is_opt_in_and_synthetic_only(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop(execution.LOCAL_DEPLOYMENT_MODE_ENV, None)
            os.environ[execution.LOCAL_SYNTHETIC_DELAY_ENV] = "12"
            self.assertEqual(execution.local_synthetic_delay_seconds({"execution_source_mode": "synthetic_trace"}), 0.0)
            os.environ[execution.LOCAL_DEPLOYMENT_MODE_ENV] = "local_dev"
            self.assertEqual(execution.local_synthetic_delay_seconds({"execution_source_mode": "synthetic_trace"}), 12.0)
            self.assertEqual(execution.local_synthetic_delay_seconds({"execution_source_mode": "real_trace"}), 0.0)

    def test_delayed_process_can_be_formally_cancelled(self):
        command = [sys.executable, "-c", "import time; time.sleep(0.1)"]
        with patch.dict(os.environ, {execution.LOCAL_DEPLOYMENT_MODE_ENV: "local_dev", execution.LOCAL_SYNTHETIC_DELAY_ENV: "10"}):
            delayed = execution.delayed_local_synthetic_command(command, 10.0)
            process = subprocess.Popen(delayed)
            with execution._process_handles_lock:
                execution._process_handles["synthetic-cancel-test"] = process
            try:
                time.sleep(0.1)
                self.assertEqual(execution.cancel_run("synthetic-cancel-test"), "confirmed_cancelled")
                self.assertIsNotNone(process.poll())
            finally:
                with execution._process_handles_lock:
                    execution._process_handles.pop("synthetic-cancel-test", None)


if __name__ == "__main__":
    unittest.main()
