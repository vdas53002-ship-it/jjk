import subprocess
import time
import sys
import os

def get_last_mtime(path):
    max_mtime = 0
    for root, dirs, files in os.walk(path):
        if any(x in root for x in ['__pycache__', '.git', 'venv', 'env']):
            continue
        for file in files:
            if file.endswith('.py'):
                try:
                    mtime = os.path.getmtime(os.path.join(root, file))
                    if mtime > max_mtime:
                        max_mtime = mtime
                except OSError:
                    pass
    return max_mtime

def run_bot():
    print("--- Starting Bot Monitor with Auto-Reload ---")
    bot_path = os.path.join(os.path.dirname(__file__), "bot.py")
    project_root = os.path.dirname(__file__)
    
    last_mtime = get_last_mtime(project_root)
    
    while True:
        print(f"[{time.strftime('%H:%M:%S')}] Starting bot.py...")
        process = subprocess.Popen([sys.executable, bot_path])
        
        while process.poll() is None:
            time.sleep(2)
            current_mtime = get_last_mtime(project_root)
            if current_mtime > last_mtime:
                print(f"[{time.strftime('%H:%M:%S')}] Change detected! Restarting bot...")
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                last_mtime = current_mtime
                break
        
        if process.poll() is not None:
            if process.returncode != 0 and process.returncode != -15: # -15 is SIGTERM
                print(f"[{time.strftime('%H:%M:%S')}] Bot crashed (code {process.returncode}). Restarting...")
            elif process.returncode == 0:
                print(f"[{time.strftime('%H:%M:%S')}] Bot stopped. Restarting...")
            
        time.sleep(2)

if __name__ == "__main__":
    run_bot()
