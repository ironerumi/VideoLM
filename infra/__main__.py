import hashlib
import zipfile
from pathlib import Path

import pulumi
import pulumi_datarobot as datarobot
from datarobot_pulumi_utils.pulumi.stack import PROJECT_NAME
from datarobot_pulumi_utils.schema.apps import CustomAppResourceBundles

# --- Build a ZIP archive of the custom execution environment ---
BASE_DIR = Path(__file__).parent
env_dir = BASE_DIR / "custom_environment"
zip_path = BASE_DIR / "custom_environment.zip"

# Create (or overwrite) the ZIP archive with all files from the custom_environment directory
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
    for file_path in env_dir.rglob("*"):
        if file_path.is_file():
            # Place files at the root of the ZIP (no leading custom_environment/ folder)
            zipf.write(file_path, file_path.relative_to(env_dir))

# Absolute path to the generated ZIP archive
docker_context_path = str(zip_path.resolve())

# --- Calculate a deterministic hash of the ZIP file contents (SHA-256) ---
with open(zip_path, "rb") as _z:
    docker_context_hash = hashlib.sha256(_z.read()).hexdigest()

# Create a custom execution environment
exe_env = datarobot.ExecutionEnvironment(
    resource_name=f"[{PROJECT_NAME}]-exe-env",
    programming_language="other",
    use_cases=["customApplication"],
    docker_context_path=docker_context_path,
    description=f"Custom execution environment for VideoLM with hash {docker_context_hash}",
)

# Export the execution environment ID
pulumi.export("execution_environment_name", exe_env.name)
pulumi.export("execution_environment_id", exe_env.id)
pulumi.export("execution_environment_version_id", exe_env.version_id)

# --- Build list of application source files for DataRobot packaging ---
# Enumerate every file under project root while excluding:
#   • any path containing ".venv" or "node_modules"
#   • all files inside "infra/" except the two launcher scripts
#     (build-app.sh and start-app.sh), which must be copied to project root
application_path = BASE_DIR.parent
source_files = []
for f in application_path.glob("**/*"):
    if not f.is_file():
        continue

    # Skip unwanted directories or paths
    IGNORED_PARTS = {
        ".venv",
        "node_modules",
        "dist",
        "uploads",
        ".git",
        ".github",
        ".vscode",
        ".idea",
        "coverage",
        ".pytest_cache",
        "__pycache__",
    }
    if any(part in IGNORED_PARTS for part in f.parts):
        continue

    # Skip infra/* unless it's the special scripts we need
    if "infra" in f.parts and f.name not in {"build-app.sh", "start-app.sh"}:
        continue

    # Special-case build/start scripts -> copy to root in DataRobot package
    if f.name in {"build-app.sh", "start-app.sh"}:
        source_files.append((f.as_posix(), f.name))
    else:
        source_files.append((f.as_posix(), f.relative_to(application_path).as_posix()))

app_source = datarobot.ApplicationSource(
    resource_name=f"[{PROJECT_NAME}]-app-source",
    name=f"[{PROJECT_NAME}]-app-source",
    files=source_files,
    base_environment_id=exe_env.id,
    base_environment_version_id=exe_env.version_id,
    resources=datarobot.ApplicationSourceResourcesArgs(
        resource_label=CustomAppResourceBundles.CPU_8XL.value.id,
        replicas=1,
        session_affinity=True,
    ),
)

app = datarobot.CustomApplication(
    resource_name=f"[{PROJECT_NAME}]-app",
    name=f"[{PROJECT_NAME}]-app",
    source_version_id=app_source.version_id,
    allow_auto_stopping=False,
)

# App output
pulumi.export("app_source_id", app_source.id)
pulumi.export("app_source_version_id", app_source.version_id)
pulumi.export("app_id", app.id)
pulumi.export("app_url", app.application_url)
