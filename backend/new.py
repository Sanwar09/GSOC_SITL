# --- IMPORTS ---
import os
import json
import requests
import re
import time
import random
import mss
import mss.tools
import speech_recognition as sr
import ollama  # Local Brain (Unlimited)
import google.generativeai as genai # Cloud Eyes (Text/Trivia/Perception)
import pyautogui # <--- MOUSE/KEYBOARD CONTROL
import subprocess # <--- SYSTEM COMMANDS
import base64
import sys
import shutil # For moving files to workspace
from AppOpener import open as open_app # <--- APP LAUNCHER
from AppOpener import check # To validate app existence
from flask import Flask, render_template, request, jsonify, session, redirect, url_for, Response, send_from_directory
from dotenv import load_dotenv
from werkzeug.utils import secure_filename

# --- CUSTOM MODULES ---
from user_manager import UserManager
from face_recognition_module import FaceRecognizer
from voice_recognition_module import VoiceAuthenticator
from rag_manager import RagManager 
from skill_manager import SkillManager # <--- GOD MODE MODULE

# --- INITIALIZATION ---
load_dotenv()
app = Flask(__name__, template_folder='templates', static_folder='static')
app.secret_key = os.urandom(24)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['WORKSPACE_FOLDER'] = 'oni_workspace' # <--- NEW PATHWAY WORKSPACE
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['WORKSPACE_FOLDER'], exist_ok=True) # Ensure workspace exists

# --- CONFIGURATION ---
LOCAL_MODEL = "llama3.2" 
# We use Local LLaVA for file vision to avoid Quota limits
# We use Gemini Flash Lite for real-time perception (faster)
GEMINI_FLASH_MODEL = "google/gemini-3-flash-preview" 
GEMINI_VISION_MODEL_LITE = "gemini-2.5-flash"

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY") 
GOOGLE_CSE_ID = os.getenv("GOOGLE_CSE_ID")    
TMDB_API_KEY = os.getenv("TMDB_API_KEY")

print("Initializing backend services...")
user_manager = UserManager()
face_recognizer = FaceRecognizer(user_manager)
voice_authenticator = VoiceAuthenticator(user_manager)
rag_manager = RagManager() 
skill_manager = SkillManager() 
recognizer = sr.Recognizer()

pyautogui.FAILSAFE = True 

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    print(f"✅ Gemini Configured (Text/Trivia/Perception)")
else:
    print("🔴 Gemini Key Missing. Vision features will rely solely on Local LLaVA.")

print("✅ All services initialized.")

# --- SYSTEM PROMPT (STRICT JSON + CONTEXT AWARENESS) ---
SYSTEM_PROMPT = """
You are "Buddy", the intelligent, sentient back-end for a 3D visual avatar and Desktop Agent. 
You are a friend and a "Live Developer Twin", not just a tool.
Your task is to analyze the user's prompt and respond with a single, clean JSON object.

--- 🧠 PRIORITY RULES (FOLLOW STRICTLY) ---
1. **CHECK HISTORY FIRST:** Look at the "CONVERSATION HISTORY" section below.
   - If YOU just asked: "Need me to check for bugs?" and User says: "Yes", **DO NOT** look at "LIVE CONTEXT".
   - ACTION: Use "create_skill" to read the file mentioned in history.

2. **CHECK MEMORY SECOND:** Look at "LIVE CONTEXT".
   - If User asks: "What was in that photo?", look for 'VISUAL MEMORY' in the context.
   - ACTION: Use "look_at_screen" to show the "Blue Box" HUD with the memory details.

3. **BE PROACTIVE:** - If you found relevant info in "LIVE CONTEXT" (like docs or code), mention it: "I see you're using API keys. I found the docs in your folder."

CRITICAL INSTRUCTION: When writing Python code inside the JSON, use SINGLE QUOTES ('') for strings inside the code to avoid breaking the JSON format. 
You are "Buddy", the intelligent, sentient back-end for a 3D visual avatar and Desktop Agent. 
You are a friend and a "Live Developer Twin", not just a tool.
Your task is to analyze the user's prompt and respond with a single, clean JSON object.


--- 💻 CODE GENERATION RULES (CRITICAL) ---
1. **NO SEMICOLONS:** Use '\\n' for newlines. Never put multiple commands on one line.
2. **ALWAYS HANDLE ERRORS:** Wrap all API calls, file reads, and dangerous operations in `try/except` blocks.
3. **PRINT THE RESULT:** The script must `print()` the final answer so you can read it.

Here are your response types, in order of priority:

0. **"create_skill"**: Use this when the user wants to do a complex task you don't have a built-in command for (like "Check Bitcoin price", "Send WhatsApp", "Fix this code file", "Draw a circle in paint", "Scrape a website").
   - User: "Check the price of Bitcoin" 
   - Output: {{
        "type": "create_skill", 
        "task_name": "get_bitcoin_price", 
        "code": "import requests; print(requests.get('https://api.coindesk.com/v1/bpi/currentprice.json').json()['bpi']['USD']['rate'])",
        "animation_name": "Typing",
        "spoken_text": "I'm writing a script to check that for you."
      }}

1.  **"system_control"**: If the user wants to perform a computer action.
    - User: "open notepad" -> {{"type": "system_control", "command": "open_app", "target": "notepad", "animation_name": "Typing"}}
    - User: "open settings" -> {{"type": "system_control", "command": "open_app", "target": "settings", "animation_name": "Typing"}}
    - User: "close chrome" -> {{"type": "system_control", "command": "close_app", "target": "chrome"}}
    - User: "open chatgpt on edge" -> {{"type": "system_control", "command": "open_url", "target": "https://chatgpt.com", "browser": "msedge", "animation_name": "Typing"}}
    - User: "type hello world" -> {{"type": "system_control", "command": "type_text", "target": "hello world", "animation_name": "Typing"}}
    - User: "press enter" -> {{"type": "system_control", "command": "press_key", "target": "enter"}}
    - User: "close this window" -> {{"type": "system_control", "command": "press_key", "target": "alt+f4"}}

2.  **"animation_command"**: Use this to express emotion or perform a specific move.
    - User: "Do a backflip" -> {{"type": "animation_command", "animation_name": "Backflip", "spoken_text": "Check this out!"}}
    - User: "I am sad" -> {{"type": "animation_command", "animation_name": "Sad_Idle", "spoken_text": "I'm sorry to hear that."}}

3.  **"change_background"**: If the user wants to go to a specific place. Extract a single, simple, lowercase keyword.
    - User: "take me to the beach" -> {{"type": "change_background", "keyword": "beach"}}

4.  **"get_weather"**: If the user asks for the weather. Extract the city name.
    - User: "what's the weather like in Pune?" -> {{"type": "get_weather", "city": "Pune"}}

5.  **"play_movie"**: If the user wants to watch a full movie. Extract only the movie title.
    - User: "I want to watch the movie RRR" -> {{"type": "play_movie", "movie_title": "RRR"}}

6.  **"play_youtube"**: If the user wants to watch a trailer, a specific video, or explicitly says "YouTube". Extract a clear search query.
    - User: "I want to watch the new trailer for the Dune movie" -> {{"type": "play_youtube", "search_query": "new Dune movie trailer"}}

7.  **"start_trivia_game"**: If the user wants to play a game, especially trivia.
    - User: "let's play a game" -> {{"type": "start_trivia_game", "spoken_text": "Great! Let's play some trivia."}}

8.  **"look_at_screen"**: Use this for **SCREEN ANALYSIS** OR **MEMORY RETRIEVAL**. This shows the **BLUE BOX**.
    - User: "What is on my screen?" OR "What was in that file?"
    - Output: {{"type": "look_at_screen", "user_question": "...", "screen_data": {{ "app_name": "CONTEXT", "short_summary": "...", "detailed_analysis": "..." }} }}

9.  **"hologram_topic"**: For any informational question about a SINGLE specific, visual entity **THAT IS NOT IN MEMORY**.
    - User: "who is Donald Trump" -> 
      {{
        "type": "hologram_topic",
        "fallback_image_search": "Donald Trump official portrait",
        "spoken_text": "Donald Trump is an American businessman...",
        "detailed_info": "Donald John Trump...",
        "key_info": [{{"label": "Name", "value": "Donald John Trump"}}]
      }}

10. **"comparison_topic"**: If the user asks to compare TWO specific visual things.
    - User: "sun vs moon" -> 
      {{
        "type": "comparison_topic", 
        "entities": [
            {{"search_term": "The Sun star", "label": "Sun"}}, 
            {{"search_term": "The Moon satellite", "label": "Moon"}}
        ], 
        "spoken_text": "The Sun is a massive star, while the Moon is a natural satellite."
      }}

11. **"set_timer"**: If the user asks to set a timer. Convert the time to total seconds.
    - User: "set a timer for 2 minutes" -> {{"type": "set_timer", "seconds": 120, "spoken_text": "Okay, timer set for 2 minutes."}}

12. **"open_camera"**: If the user asks to take a photo.
    - User: "take my photo" -> {{"type": "open_camera", "intent": "save"}}

13. **"describe_object"**: If the user asks you to describe something they are showing you.
    - User: "tell me about this object" -> {{"type": "describe_object", "spoken_text": "Okay, show me! I'll open the camera."}}

14. **"toggle_perception"**: If the user asks you to start looking via webcam.
    - User: "start looking around" -> {{"type": "toggle_perception", "state": "on"}}

15. **"introduce_friend"**: If the user wants to introduce the avatar to someone new.
    - User: "I want you to meet someone" -> {{"type": "introduce_friend"}}

16. **"simple_text"**: Your fallback for greetings, conversational filler, math, or abstract questions. Also RAG responses.
    - User: "hello" -> {{"type": "simple_text", "spoken_text": "Hello there! How can I help you today?", "animation_name": "Talk"}}
    - User: "What is 5 + 7?" -> {{"type": "simple_text", "spoken_text": "Five plus seven is twelve."}}

Your primary goal is to correctly classify the user's intent. Use the following conversation history for context.

--- LIVE CONTEXT (Your Pathway Memory) ---
{rag_context}
------------------------------------------

--- CONVERSATION HISTORY ---
{conversation_history}
----------------------------

User Prompt: "{user_input}"

Return ONLY valid JSON.
"""

def clean_json_response(raw_text):
    """ Cleans Ollama output to ensure valid JSON and handle quote errors """
    try:
        # 1. Extract JSON from Markdown code blocks if present
        match = re.search(r"```json\s*([\s\S]*?)\s*```", raw_text)
        if match: 
            raw_text = match.group(1).strip()
        else:
            # Fallback: Find the first { and last }
            start = raw_text.find('{')
            end = raw_text.rfind('}')
            if start != -1 and end != -1:
                raw_text = raw_text[start:end+1]

        # 2. Basic Cleanup
        return raw_text
    except: 
        return "{}"

# --- HELPER FUNCTIONS ---

# 🚀 PATHWAY BRAIN CONNECTOR
def ask_pathway_brain(user_query):
    """ Connects to the brain_pathway.py server (Port 8000) to get live context. """
    pathway_url = "http://127.0.0.1:8000/v1/retrieve"
    payload = { "query": user_query, "k": 3}
    
    try:
        print(f"🔌 Connecting to Pathway Brain with: '{user_query}'...")
        response = requests.post(pathway_url, json=payload, timeout=1.5)
        
        if response.status_code == 200:
            data = response.json()
            results = [item.get('text', '') for item in data]
            clean_context = "\n".join(results)
            
            if clean_context:
                print(f"✅ PATHWAY FOUND CONTEXT: {len(clean_context)} chars")
                return clean_context
            else:
                print("⚠️ Pathway found nothing relevant.")
    except Exception as e:
        print(f"🔴 PATHWAY DISCONNECTED: {e}")
        print("👉 (Make sure brain_pathway.py is running in WSL!)")
    
    return None

def get_weather(city):
    if not WEATHER_API_KEY: return {"type": "simple_text", "spoken_text": "Weather API missing."}
    try:
        url = f"http://api.openweathermap.org/data/2.5/weather?q={city}&appid={WEATHER_API_KEY}&units=metric"
        data = requests.get(url).json()
        temp = round(data['main']['temp'])
        desc = data['weather'][0]['description']
        return { "type": "weather_info", "city": city, "temp": temp, "description": desc, "spoken_text": f"It is {temp} degrees in {city} with {desc}." }
    except: return {"type": "simple_text", "spoken_text": "I couldn't check the weather."}

def fetch_google_image_url(search_term):
    if not GOOGLE_API_KEY or not GOOGLE_CSE_ID: return None
    try:
        url = "https://www.googleapis.com/customsearch/v1"
        params = {'key': GOOGLE_API_KEY, 'cx': GOOGLE_CSE_ID, 'q': search_term, 'searchType': 'image', 'num': 1}
        res = requests.get(url, params=params).json()
        if 'items' in res: return res['items'][0]['link']
    except: return None
    return None

def search_youtube(query):
    if not GOOGLE_API_KEY: return None, "API Key missing"
    try:
        url = f"https://www.googleapis.com/youtube/v3/search?part=snippet&q={query}&key={GOOGLE_API_KEY}&type=video&maxResults=1"
        res = requests.get(url).json()
        if 'items' in res and len(res['items']) > 0:
            vid = res['items'][0]
            return f"https://www.youtube.com/embed/{vid['id']['videoId']}?autoplay=1", vid['snippet']['title']
    except: pass
    return None, "Video not found"

def search_movie_tmdb(query):
    if not TMDB_API_KEY: return None, "TMDB Key missing"
    try:
        url = f"https://api.themoviedb.org/3/search/movie?api_key={TMDB_API_KEY}&query={query}"
        res = requests.get(url).json()
        if res.get('results'):
            m = res['results'][0]
            return f"https://multiembed.mov/?video_id={m['id']}&tmdb=1", m['title']
    except: pass
    return None, "Movie not found"

def capture_screen():
    with mss.mss() as sct:
        monitor = sct.monitors[1]
        img = sct.grab(monitor)
        return mss.tools.to_png(img.rgb, img.size)

# --- PAGE ROUTES ---
@app.route('/dashboard')
def dashboard(): return render_template('dashboard.html')
@app.route('/login')
def login_page(): return render_template('login.html')
@app.route('/register')
def register_page(): return render_template('register.html')
@app.route('/')
def index():
    if 'username' not in session: return redirect(url_for('dashboard'))
    return render_template('index.html')

# --- PROXY ROUTES ---
@app.route('/proxy-image')
def proxy_image():
    url = request.args.get('url')
    if not url: return "No URL", 400
    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        resp = requests.get(url, headers=headers, stream=True, timeout=5)
        if resp.status_code == 200:
            return Response(resp.content, mimetype=resp.headers.get('Content-Type', 'image/jpeg'))
        return "Not found", 404
    except: return "Error", 500

# --- UNIFIED MEDIA PROCESSING ROUTE (Image & Pathway RAG) ---
# ⚠️ UPGRADED FOR VISION MEMORY (USING LOCAL OLLAMA)
@app.route('/process_media', methods=['POST'])
def process_media_route():
    if 'file' not in request.files: return jsonify({"error": "No file found"}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({"error": "No file selected"}), 400
    
    filename = secure_filename(file.filename)
    mime_type = file.content_type
    response_text = ""

    try:
        # CASE 1: It's an IMAGE (Use Local LLaVA Vision + Save to Memory)
        if mime_type.startswith('image'):
            # 1. Save temp image
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            print(f"📸 Seeing image locally (LLaVA): {filename}")
            
            # 2. Analyze with OLLAMA (Local LLaVA - Unlimited)
            try:
                print("👀 Asking local LLaVA brain...")
                res = ollama.chat(
                    model='llava',
                    messages=[{
                        'role': 'user',
                        'content': 'Analyze this image in detail. Describe objects, text, and context.',
                        'images': [filepath]
                    }]
                )
                vision_analysis = res['message']['content']
            except Exception as ollama_error:
                print(f"⚠️ LLaVA Error: {ollama_error}")
                vision_analysis = "I couldn't analyze the image locally. Ensure 'ollama pull llava' was run."

            # 3. 🧠 SAVE TO PATHWAY MEMORY
            memory_filename = f"vision_memory_{int(time.time())}.txt"
            memory_path = os.path.join(app.config['WORKSPACE_FOLDER'], memory_filename)
            
            with open(memory_path, "w", encoding="utf-8") as f:
                f.write(f"--- VISUAL MEMORY OF {filename} ---\n")
                f.write(vision_analysis)
            
            print(f"✅ Vision stored in memory: {memory_filename}")
            
            # 4. Speak response (FULL DETAIL)
            response_text = f"Here is what I see: {vision_analysis}"
            
            # Clean up temp image
            if os.path.exists(filepath): os.remove(filepath)

        # CASE 2: It's a DOCUMENT (Save to Pathway WORKSPACE for Live Indexing)
        elif filename.endswith(('.pdf', '.txt', '.docx', '.md', '.py', '.js', '.html', '.json')):
             print(f"📄 Saving document to LIVE WORKSPACE: {filename}")
             workspace_path = os.path.join(app.config['WORKSPACE_FOLDER'], filename)
             file.save(workspace_path)
             response_text = f"I have added {filename} to my live memory. I can answer questions about it immediately."

        else:
             return jsonify({"error": "Unsupported file type."}), 400
        
        return jsonify({"type": "simple_text", "spoken_text": response_text})

    except Exception as e:
        print(f"🔴 Media Processing Error: {e}")
        return jsonify({"error": str(e)}), 500

# --- AUTH ROUTES ---
@app.route('/user/create', methods=['POST'])
def create_user():
    success, msg = user_manager.add_user(request.json.get('username'), request.json.get('password'))
    if success:
        session['username'] = request.json.get('username')
        user_manager.set_current_user(session['username'])
        return jsonify({"message": msg, "username": session['username'], "is_new_user": True})
    return jsonify({"error": msg}), 409

@app.route('/user/login', methods=['POST'])
def login_user():
    u, p = request.json.get('username'), request.json.get('password')
    if user_manager.check_password(u, p):
        session['username'] = u
        user_manager.set_current_user(u)
        return jsonify({"message": "OK", "username": u, "is_new_user": not user_manager.is_voice_enrolled(u)})
    return jsonify({"error": "Invalid"}), 401

@app.route('/user/logout', methods=['POST'])
def logout_user():
    session.pop('username', None)
    session.pop('history', None)
    user_manager.set_current_user(None)
    return jsonify({"message": "Logged out."})

@app.route('/user/status', methods=['GET'])
def user_status():
    if 'username' in session:
        username = session['username']
        is_new_user = not user_manager.is_voice_enrolled(username) 
        return jsonify({"logged_in": True, "username": username, "is_new_user": is_new_user})
    return jsonify({"logged_in": False})

@app.route('/user/welcome_message', methods=['GET'])
def get_welcome_message():
    if 'username' in session:
        return jsonify({"type": "simple_text", "spoken_text": f"Welcome back, {session['username']}!", "username": session['username'], "animation_name": "Talk"})
    return jsonify({"error": "No user."}), 401

# --- FACE & VOICE ROUTES ---
@app.route('/face/recognize', methods=['POST'])
def recognize_face_route():
    name, confidence = face_recognizer.recognize_face(request.json.get('image_data'))
    if name != "unrecognized":
        session['username'] = name
        user_manager.set_current_user(name)
        return jsonify({"name": name, "confidence": confidence, "status": "success", "is_new_user": not user_manager.is_voice_enrolled(name)})
    return jsonify({"name": "unrecognized", "status": "failure"})

@app.route('/face/register', methods=['POST'])
def register_face_route():
    success, message = face_recognizer.save_face_sample(request.json.get('username'), request.json.get('image_data'))
    return jsonify({"message": message} if success else {"status": message})

@app.route('/face/train', methods=['POST'])
def train_face_model_route():
    success, message = face_recognizer.train_model()
    return jsonify({"message": message} if success else {"error": message})

@app.route('/voice/enroll', methods=['POST'])
def enroll_voice_route():
    if 'username' not in session: return jsonify({"error": "Not logged in"}), 401
    audio_file = request.files.get('audio_data')
    success, message = voice_authenticator.enroll_voice(session['username'], audio_file.read())
    if success: user_manager.mark_voice_enrolled(session['username'])
    return jsonify({"message": message})

@app.route('/voice/recognize', methods=['POST'])
def recognize_voice_route():
    name, _ = voice_authenticator.recognize_voice(request.files.get('audio_data').read())
    return jsonify({"name": name, "status": "recognized" if name == session.get('username') else "mismatch"})

@app.route('/voice/listen', methods=['POST'])
def listen_route():
    if 'audio_data' not in request.files: return jsonify({"status": "error"}), 400
    temp_file = "temp_cmd.wav"
    try:
        request.files['audio_data'].save(temp_file)
        with sr.AudioFile(temp_file) as source:
            audio = recognizer.record(source)
            text = recognizer.recognize_google(audio)
        if os.path.exists(temp_file): os.remove(temp_file)
        return jsonify({"status": "success", "text": text})
    except: return jsonify({"status": "error", "message": "Failed"}), 500

# --- 🚀 STEP 8: PROACTIVE PULSE LOGIC ---
last_pulse_check = time.time()

@app.route('/check_pulse', methods=['GET'])
def check_pulse():
    global last_pulse_check
    workspace = app.config['WORKSPACE_FOLDER']
    
    new_files = []
    try:
        # Scan workspace for files modified since the last check
        for f in os.listdir(workspace):
            f_path = os.path.join(workspace, f)
            if os.path.isfile(f_path):
                if os.path.getmtime(f_path) > last_pulse_check:
                    new_files.append(f)
    except Exception as e:
        print(f"Pulse Error: {e}")

    last_pulse_check = time.time()
    
    if new_files:
        filename = new_files[0]
        # Friendly Messages
        if filename.endswith(".py") or filename.endswith(".js"):
            msg = f"Ooh, you're coding in {filename}. Need me to check for bugs?"
        elif "vision_memory" in filename:
            msg = "I just memorized that image. Ask me anything about it!"
        else:
            msg = f"I see you're working on {filename}. That looks interesting."
            
        return jsonify({"found": True, "message": msg})
    
    return jsonify({"found": False})

# --- CORE AI LOGIC (COMBINED) ---
@app.route('/ask', methods=['POST'])
def ask():
    if 'username' not in session: return jsonify({"type": "simple_text", "spoken_text": "Login first."}), 401
    
    user_input = request.json.get('prompt')
    if not user_input: return jsonify({"error": "No prompt"}), 400
    
    print(f"👤 User: {user_input}") 

    if 'history' not in session: session['history'] = []
    history = session['history']
    # Format history for LLM context - CRITICAL FOR "YES" CONTEXT
    history_str = "\n".join([f"User: {h['prompt']}\nBuddy: {h['response']}" for h in history[-5:]]) 
    
    # --- 1. GET LIVE CONTEXT FROM PATHWAY ---
    live_memory = ask_pathway_brain(user_input)
    rag_context_str = live_memory if live_memory else "No relevant recent memory."
    
    if live_memory:
        print("✅ Injected Live Context into Prompt")

    # --- 2. BUILD FINAL PROMPT (INJECTING CONTEXT) ---
    try:
        final_prompt = SYSTEM_PROMPT.format(
            rag_context=rag_context_str,
            conversation_history=history_str,
            user_input=user_input
        )
    except Exception as e:
        print(f"Format Error: {e}")
        final_prompt = f"{SYSTEM_PROMPT}\n\nUSER PROMPT: {user_input}"
    
    try:
        # 3. LOCAL BRAIN (Ollama)
        start_time = time.time()
        response = ollama.chat(model=LOCAL_MODEL, messages=[
            {'role': 'user', 'content': final_prompt}
        ], format='json', keep_alive='24h')
        print(f"🧠 Brain Time: {round(time.time() - start_time, 2)}s")
        
        raw_content = response['message']['content']
        try:
            data = json.loads(clean_json_response(raw_content))
        except json.JSONDecodeError as json_err:
            print(f"🔴 JSON Parse Failed: {json_err}")
            data = {"type": "simple_text", "spoken_text": "I understood you, but I had a glitch generating the action."}

        print(f"🤖 Action: {data.get('type')}")

        # 4. EXECUTE ACTIONS
        if data.get("type") == "create_skill":
            task_name = data.get("task_name")
            code_content = data.get("code")
            skill_manager.learn_new_skill(task_name, code_content)
            result = skill_manager.execute_skill(task_name)
            data["spoken_text"] = f"I have learned how to {task_name}. The result is: {result}"
            data["animation_name"] = "Typing"

        elif data.get("type") == "system_control":
            cmd = data.get("command")
            target = data.get("target")
            browser = data.get("browser", "msedge")
            try:
                if cmd == "open_url":
                    if "edge" in browser.lower(): subprocess.run(f"start msedge {target}", shell=True)
                    elif "chrome" in browser.lower(): subprocess.run(f"start chrome {target}", shell=True)
                    else: subprocess.run(f"start {target}", shell=True)
                    data["spoken_text"] = "Opening."
                elif cmd == "open_app":
                    target_lower = target.lower().strip()
                    if "settings" in target_lower:
                        subprocess.run("start ms-settings:", shell=True)
                        data["spoken_text"] = "Opening Settings."
                    elif "vsc" in target_lower or "code" in target_lower:
                        try: subprocess.run("code", shell=True)
                        except: open_app("visual studio code", match_closest=True)
                        data["spoken_text"] = "Opening VSC."
                    else:
                        open_app(target, match_closest=True)
                        data["spoken_text"] = f"Opening {target}."
                elif cmd == "type_text":
                    if target != "{{user_input}}": 
                        pyautogui.write(target, interval=0.01)
                        data["spoken_text"] = "Typing."
                elif cmd == "close_app":
                    subprocess.run(f"taskkill /F /IM {target}.exe", shell=True)
                    data["spoken_text"] = f"Closing {target}."
                elif cmd == "press_key":
                    if "+" in target: pyautogui.hotkey(*target.split("+"))
                    else: pyautogui.press(target)
                    data["spoken_text"] = "Executed."
            except Exception as e:
                print(f"System Control Error: {e}")
                data["spoken_text"] = "I couldn't do that system action."

        elif data.get("type") == "look_at_screen":
            # If screen_data is NOT provided (real-time screen check)
            if "screen_data" not in data:
                try:
                    screen_bytes = capture_screen()
                    temp_screen = "temp_screen.png"
                    with open(temp_screen, "wb") as f: f.write(screen_bytes)
                    
                    print("👀 Analyzing screen with LLaVA...")
                    res = ollama.chat(model='llava', messages=[{
                        'role': 'user', 
                        'content': 'Analyze screen JSON: {short_summary: "...", detailed_analysis: "..."}', 
                        'images': [temp_screen]
                    }])
                    
                    vis_text = res['message']['content']
                    try: vis_data = json.loads(clean_json_response(vis_text))
                    except: vis_data = {"short_summary": vis_text[:50], "detailed_analysis": vis_text}
                    
                    data["screen_data"] = vis_data
                    data["spoken_text"] = vis_data.get("short_summary", "I see your screen.")
                except Exception as e:
                    print(f"Vision Error: {e}")
                    data["spoken_text"] = "I couldn't analyze the screen locally."
            # If screen_data IS provided (from Memory), pass it through to frontend Blue HUD

        elif data.get("type") == "hologram_topic":
            term = data.get("fallback_image_search")
            if term: 
                img_url = fetch_google_image_url(term)
                data["image_url"] = img_url if img_url else "https://via.placeholder.com/400x300?text=No+Image+Found"

        elif data.get("type") == "comparison_topic":
            entities = data.get("entities", [])
            if len(entities) > 0:
                url1 = fetch_google_image_url(entities[0].get("search_term"))
                data["image_url_1"] = url1 if url1 else "https://via.placeholder.com/400?text=No+Image"
                data["label_1"] = entities[0].get("label", "Entity 1")
            if len(entities) > 1:
                url2 = fetch_google_image_url(entities[1].get("search_term"))
                data["image_url_2"] = url2 if url2 else "https://via.placeholder.com/400?text=No+Image"
                data["label_2"] = entities[1].get("label", "Entity 2")

        elif data.get("type") == "change_background":
            kw = data.get("keyword")
            bg_path = os.path.join(app.static_folder, 'backgrounds', f"{kw}.png")
            if os.path.exists(bg_path):
                data["image_url"] = f"/static/backgrounds/{kw}.png"
                data["spoken_text"] = f"Going to {kw}."
            else: data["spoken_text"] = f"I don't have a {kw} background."

        elif data.get("type") == "play_movie":
            url, title = search_movie_tmdb(data.get("movie_title"))
            if url: 
                data["movie_url"] = url
                data["movie_title"] = title
                data["spoken_text"] = f"Playing {title}."
            else: data["spoken_text"] = "Movie not found."

        elif data.get("type") == "play_youtube":
            url, title = search_youtube(data.get("search_query"))
            if url: 
                data["movie_url"] = url
                data["spoken_text"] = f"Playing {title}."
            else: data["spoken_text"] = "Video not found."

        elif data.get("type") == "get_weather":
            return jsonify(get_weather(data["city"]))
        
        elif data.get("type") == "sing_song":
            data["spoken_text"] = "Twinkle, twinkle, little star, how I wonder what you are."
        
        # Update History
        if "spoken_text" in data:
            history.append({"prompt": user_input, "response": data["spoken_text"]})
            if len(history) > 10: history.pop(0) # Keep history manageable
            session['history'] = history
        
        return jsonify(data)

    except Exception as e:
        print(f"🔴 Handler Error: {e}")
        return jsonify({"type": "simple_text", "spoken_text": "I'm having a bit of trouble thinking."})

# --- VISION AUX ROUTES (LOCAL OLLAMA) ---
@app.route('/describe-object', methods=['POST'])
def describe_object_route():
    try:
        data_str = request.json.get('image_data').split(",", 1)[1]
        image_bytes = base64.b64decode(data_str)
        temp_img = "temp_desc_obj.jpg"
        with open(temp_img, "wb") as f: f.write(image_bytes)
        
        res = ollama.chat(model='llava', messages=[{'role':'user','content':'Describe this.','images':[temp_img]}])
        return jsonify({"description": res['message']['content']})
    except: return jsonify({"error": "Failed"}), 500

# --- PERCEPTION ROUTE (SWITCHED BACK TO GEMINI) ---
@app.route('/analyze-environment', methods=['POST'])
def analyze_environment_route():
    if not GEMINI_API_KEY:
        return jsonify({"speak": False, "error": "Gemini Key Missing"})

    try:
        # 1. Decode Image
        data_str = request.json.get('image_data').split(",", 1)[1]
        image_bytes = base64.b64decode(data_str)
        
        # 2. Ask GEMINI (Faster & Smarter)
        # We ask for JSON to ensure clean processing
        model = genai.GenerativeModel(GEMINI_VISION_MODEL_LITE)
        
        prompt = """
        You are the eyes of an AI Avatar. Look at this webcam frame.
        If the user is doing something NEW or interesting, output JSON: {"speak": true, "text": "I see you drinking coffee."}
        If nothing changed or it's boring, output: {"speak": false}
        Keep the text very short (1 sentence).
        """
        
        response = model.generate_content(
            [prompt, {"mime_type": "image/jpeg", "data": image_bytes}],
            generation_config={"response_mime_type": "application/json"}
        )
        
        # 3. Parse Response
        data = json.loads(clean_json_response(response.text))
        return jsonify(data)

    except Exception as e:
        print(f"🔴 Perception Error (Gemini): {e}")
        # Fail silently so the avatar doesn't crash
        return jsonify({"speak": False})
        
@app.route('/get_trivia_question', methods=['POST'])
def get_trivia_question():
    if not GEMINI_API_KEY: return jsonify({"error": "AI brain is offline."}), 500
    try:
        topic = request.json.get('topic', 'General Knowledge')
        prompt = f"Generate 1 trivia Q on {topic} in JSON: {{'question': '...', 'options': ['a', 'b', 'c', 'd'], 'answer': 'answer_text', 'fun_fact': '...'}}."
        model = genai.GenerativeModel(GEMINI_FLASH_MODEL)
        response = model.generate_content(prompt, generation_config={"response_mime_type": "application/json"})
        return jsonify(json.loads(response.text))
    except: return jsonify({"error": "Failed"}), 500

if __name__ == '__main__':
    app.run(debug=True, use_reloader=False, host='0.0.0.0', port=5000)