import os

def create_structure():
    # The Root Name
    base_dir = "ONI_Trinity_Core"
    
    # The Modular Anatomy
    structure = {
        "backend": [
            "server.py",  # The new entry point (formerly app.py)
            "config.py",  # API Keys and Settings
        ],
        "backend/core": [
            "__init__.py",
            "life_loop.py", # The Heartbeat
            "orchestrator.py" # Decides action
        ],
        "backend/senses": [
            "__init__.py",
            "ears_hearing.py", # VAD & Speech to Text
            "eyes_vision.py",  # God Mode (Screenshots)
            "vibe_check.py"    # Emotion Detection
        ],
        "backend/brain": [
            "__init__.py",
            "memory_short.py", # Pathway Integration
            "memory_long.py",  # ChromaDB
            "reasoning.py"     # Llama 3.2
        ],
        "backend/hands": [
            "__init__.py",
            "os_control.py",   # Apps, volume, brightness
            "web_agent.py",    # Browsing
            "shivaji_mode.py"  # Deep automation
        ],
        "backend/security": [
            "__init__.py",
            "gatekeeper.py",   # FaceID & Lockdown
            "intruder_log/"    # Folder for intruder photos
        ],
        "frontend/static": [
            "css/style.css",
            "js/main.js",
            "js/avatar.js"
        ],
        "frontend/templates": [
            "index.html",
            "login.html",
            "dashboard.html"
        ],
        "oni_workspace": [] 
    }

    print(f"🚀 Initializing ONI TRINITY Protocol in '{base_dir}'...")

    if not os.path.exists(base_dir):
        os.makedirs(base_dir)

    for folder, files in structure.items():
        path = os.path.join(base_dir, folder)
        os.makedirs(path, exist_ok=True)
        
        for file in files:
            if not file.endswith("/"): 
                file_path = os.path.join(path, file)
                
                # --- THE FIX: Create sub-directory if it doesn't exist ---
                file_dir = os.path.dirname(file_path)
                if not os.path.exists(file_dir):
                    os.makedirs(file_dir)
                # ---------------------------------------------------------

                if not os.path.exists(file_path):
                    with open(file_path, 'w') as f:
                        f.write(f"# ONI MODULE: {file}\n# Part of the Trinity Architecture\n")
                    print(f"   📄 Generated: {file}")
            else:
                # It is a folder inside a folder (like intruder_log)
                sub_folder_path = os.path.join(path, file)
                os.makedirs(sub_folder_path, exist_ok=True)
                print(f"   📂 Created Subfolder: {file}")

    print("\n✅ DONE. The body is ready. We can now transplant the brain.")
    print(f"👉 Your new workspace is: {base_dir}")

if __name__ == "__main__":
    create_structure()