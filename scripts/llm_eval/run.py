"""headless CLI로 같은 프롬프트를 여러 모델에 보내고 원문 출력과 소요 시간을 남긴다.

사용: python3 run.py <라벨> [<라벨> ...]   라벨은 MODELS의 키
"""
import json, os, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor

BASE = os.path.dirname(os.path.abspath(__file__))
RUN = os.path.join(BASE, os.environ.get("RUN_DIR", "run"))
SYSTEM = open(os.path.join(RUN, "system.txt"), encoding="utf-8").read()
USER = open(os.path.join(RUN, "user.txt"), encoding="utf-8").read()
FULL = open(os.path.join(RUN, "full_prompt.txt"), encoding="utf-8").read()
SCHEMA_PATH = os.path.join(RUN, "schema.json")
SCHEMA = open(SCHEMA_PATH).read()


def claude(model):
    return ["claude", "-p", "--model", model, "--system-prompt", SYSTEM, "--tools", "",
            "--json-schema", SCHEMA, "--output-format", "json", "--no-session-persistence",
            "--strict-mcp-config", "--setting-sources", ""], USER


def codex(model, effort):
    return ["codex", "exec", "-m", model, "-c", f"model_reasoning_effort=\"{effort}\"", "-s", "read-only",
            "--skip-git-repo-check", "--ephemeral", "--output-schema", SCHEMA_PATH, "-o", "__OUT__", "-"], FULL


def agy(model):
    return ["agy", "--model", model, "--json-schema", SCHEMA, "--output-format", "json",
            "--disable-slash-commands", "--print-timeout", "600s", "-p", FULL], None


MODELS = {
    "claude-haiku": lambda: claude("haiku"),
    "claude-sonnet": lambda: claude("sonnet"),
    "gpt-6-luna": lambda: codex("gpt-6-luna", "low"),
    "gpt-6-sol": lambda: codex("gpt-6-sol", "low"),
    "gemini-3.8-flash-low": lambda: agy("gemini-3.8-flash-low"),
    "gemini-3.8-flash-high": lambda: agy("gemini-3.8-flash-high"),
}


def one(label, rep):
    cmd, stdin = MODELS[label]()
    tag = f"{label}__{rep}"
    wd = os.path.join(RUN, "cwd", tag)
    os.makedirs(wd, exist_ok=True)
    out_file = os.path.join(RUN, "out", tag + ".last.txt")
    os.makedirs(os.path.dirname(out_file), exist_ok=True)
    cmd = [out_file if c == "__OUT__" else c for c in cmd]
    t = time.time()
    p = subprocess.run(cmd, input=stdin, capture_output=True, text=True, cwd=wd, timeout=900)
    dt = time.time() - t
    raw = {"label": label, "rep": rep, "seconds": round(dt, 1), "returncode": p.returncode,
           "stdout": p.stdout, "stderr": p.stderr[-4000:],
           "last": open(out_file, encoding="utf-8").read() if os.path.exists(out_file) else None}
    json.dump(raw, open(os.path.join(RUN, "out", tag + ".json"), "w", encoding="utf-8"), ensure_ascii=False)
    return f"{tag}: rc={p.returncode} {dt:.1f}s"


if __name__ == "__main__":
    labels = sys.argv[1:]
    reps = int(os.environ.get("REPS", "1"))
    jobs = [(l, r) for l in labels for r in range(1, reps + 1)]
    with ThreadPoolExecutor(max_workers=len(jobs)) as ex:
        for line in ex.map(lambda j: one(*j), jobs):
            print(line, flush=True)
