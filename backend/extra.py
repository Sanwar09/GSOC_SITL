# # --- IMPORTS ---
# import os
# import json
# import random
# import requests
# import re
# import time
# import mss          
# import mss.tools
# from flask import Flask, render_template, request, jsonify, session, redirect, url_for, Response
# from datetime import datetime
# import google.generativeai as genai
# from dotenv import load_dotenv

# from user_manager import UserManager
# from face_recognition_module import FaceRecognizer
# from voice_recognition_module import VoiceAuthenticator

# load_dotenv()

# app = Flask(__name__, template_folder='templates', static_folder='static')
# app.secret_key = os.urandom(24)

# GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
# WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")
# GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
# GOOGLE_CSE_ID = os.getenv("GOOGLE_CSE_ID")
# TMDB_API_KEY = os.getenv("TMDB_API_KEY")

# print("Initializing backend services...")
# user_manager = UserManager()
# face_recognizer = FaceRecognizer(user_manager)
# voice_authenticator = VoiceAuthenticator(user_manager)
# print("✅ All services initialized.")

# if not GEMINI_API_KEY:
#     print("🔴 FATAL ERROR: GEMINI_API_KEY not set.")
# else:
#     try:
#         genai.configure(api_key=GEMINI_API_KEY)
#         print("✅ Google AI configured.")
#     except Exception as e:
#         print(f"🔴 Google AI Error: {e}")

# # --- ✅ DYNAMIC MODEL FINDER (The Fix) ---
# def get_working_model():
#     """
#     Asks Google for available models and picks the best one that actually exists.
#     """
#     try:
#         # 1. Get list of ALL models your key can access
#         all_models = genai.list_models()
        
#         # 2. Filter for models that can generate content
#         valid_models = [m.name for m in all_models if 'generateContent' in m.supported_generation_methods]
        
#         # 3. Strategy: Look for 'flash', then 'pro', then take whatever is left
        
#         # Check for Flash (Fastest)
#         for model in valid_models:
#             if 'flash' in model.lower() and '1.5' in model:
#                 # print(f"✨ Auto-Selected Model: {model}")
#                 return genai.GenerativeModel(model)

#         # Check for Pro (Smarter)
#         for model in valid_models:
#             if 'pro' in model.lower() and '1.5' in model:
#                 # print(f"✨ Auto-Selected Model: {model}")
#                 return genai.GenerativeModel(model)

#         # Fallback: Just take the first valid one we found
#         if valid_models:
#             print(f"⚠️ Preferred model missing. Using available: {valid_models[0]}")
#             return genai.GenerativeModel(valid_models[0])
            
#     except Exception as e:
#         print(f"⚠️ Model lookup failed: {e}. Trying hardcoded default.")
    
#     # Absolute last resort
#     return genai.GenerativeModel('gemini-1.5-flash')

# # --- SYSTEM PROMPT (UNCHANGED) ---
# SYSTEM_PROMPT = """
# You are the intelligent back-end for a 3D visual avatar. Your task is to analyze the user's prompt and respond with a single, clean JSON object.

# Here are your response types, in order of priority:

# 1.  **"change_background"**: If the user wants to go to a specific place. Extract a single, simple, lowercase keyword.
#     - User: "take me to the beach" -> {{"type": "change_background", "keyword": "beach"}}

# 2.  **"get_weather"**: If the user asks for the weather. Extract the city name.
#     - User: "what's the weather like in Pune?" -> {{"type": "get_weather", "city": "Pune"}}

# 3.  **"play_movie"**: If the user wants to watch a full movie. Extract only the movie title.
#     - User: "I want to watch the movie RRR" -> {{"type": "play_movie", "movie_title": "RRR"}}

# 4.  **"play_youtube"**: If the user wants to watch a trailer or specific video.
#     - User: "I want to watch the new trailer for Dune" -> {{"type": "play_youtube", "search_query": "new Dune movie trailer"}}

# 5.  **"start_trivia_game"**: If the user wants to play a game.
#     - User: "let's play a game" -> {{"type": "start_trivia_game", "spoken_text": "Great! Let's play some trivia."}}

# 6.  **"look_at_screen"**: If the user asks you to read, analyze, or explain what is currently visible on their computer screen.
#     - User: "What code is on my screen?" -> {{"type": "look_at_screen", "user_question": "What code is on my screen?"}}
#     - User: "Help me fix this error" -> {{"type": "look_at_screen", "user_question": "Help me fix this error displayed on the screen."}}

# 7.  **"hologram_topic"**: For any informational question about a SINGLE specific, visual entity (person, place, or thing).
#     - User: "who is Donald Trump" -> {{"type": "hologram_topic", "fallback_image_search": "Donald Trump", "spoken_text": "...", "key_info": [...]}}

# 8.  **"comparison_topic"**: If the user asks to compare two specific visual things.
#     - User: "sun vs moon" -> {{"type": "comparison_topic", "entities": [...], "spoken_text": "..."}}

# 9.  **"set_timer"**: If the user asks to set a timer.
#     - User: "set a timer for 2 minutes" -> {{"type": "set_timer", "seconds": 120, "spoken_text": "Timer set."}}

# 10. **"open_camera"**: If the user asks to take a photo.
#     - User: "take my photo" -> {{"type": "open_camera", "intent": "save"}}

# 11. **"describe_object"**: If the user asks you to describe something they are showing via the WEBCAM.
#     - User: "look at this object in my hand" -> {{"type": "describe_object", "spoken_text": "Show me! Opening camera."}}

# 12. **"animation_command"**: For simple commands like "dance", "jump", "walk".
#     - User: "do a dance" -> {{"type": "animation_command", "animation_name": "dance", "spoken_text": "Watch this!"}}

# 13. **"math_sequence"**: For simple mathematical calculations.
#     - User: "what is 5 plus 7" -> {{"type": "math_sequence", "elements": ["5", "+", "7", "=", "12"], "spoken_text": "Five plus seven is twelve."}}

# 14. **"sing_song"**: If the prompt includes "sing a song".
#     - User: "sing me a song" -> {{"type": "sing_song"}}

# 15. **"toggle_perception"**: If the user asks you to start looking via webcam.
#     - User: "start looking around" -> {{"type": "toggle_perception", "state": "on"}}

# 16. **"simple_text"**: Your fallback for greetings or abstract questions.
#     - User: "hello" -> {{"type": "simple_text", "spoken_text": "Hello there! How can I help you?"}}

# 17. **"introduce_friend"**: If the user wants to introduce the avatar to someone new.
#     - User: "I want you to meet someone" -> {{"type": "introduce_friend"}}

# Your primary goal is to correctly classify the user's intent. Use the following conversation history for context.

# ---
# Conversation History:
# {conversation_history}
# ---
# """

# def clean_gemini_json_response(raw_text):
#     match = re.search(r"```json\s*([\s\S]*?)\s*```", raw_text)
#     if match:
#         return match.group(1).strip()
#     return raw_text.strip()

# # --- Helper Functions ---
# def get_weather(city):
#     if not WEATHER_API_KEY:
#         return {"type": "simple_text", "spoken_text": "I can't check the weather right now."}
#     base_url = "http://api.openweathermap.org/data/2.5/weather"
#     params = {'q': city, 'appid': WEATHER_API_KEY, 'units': 'metric'}
#     try:
#         response = requests.get(base_url, params=params)
#         response.raise_for_status()
#         weather_data = response.json()
#         temp = round(weather_data['main']['temp'])
#         description = weather_data['weather'][0]['description']
#         return { "type": "weather_info", "city": city, "temp": temp, "description": description, "spoken_text": f"The current temperature in {city} is {temp} degrees Celsius with {description}." }
#     except Exception:
#         return {"type": "simple_text", "spoken_text": "I'm having trouble connecting to my weather station."}

# def fetch_google_image_url(search_term):
#     if not GOOGLE_API_KEY or not GOOGLE_CSE_ID: return None
#     try:
#         url = "https://www.googleapis.com/customsearch/v1"
#         params = {'key': GOOGLE_API_KEY, 'cx': GOOGLE_CSE_ID, 'q': search_term, 'searchType': 'image', 'num': 1}
#         response = requests.get(url, params=params)
#         if response.status_code == 200:
#             data = response.json()
#             if 'items' in data: return data['items'][0]['link']
#         return None
#     except Exception:
#         return None

# def search_youtube(query):
#     if not GOOGLE_API_KEY: return None, "API Key is missing."
#     search_url = "https://www.googleapis.com/youtube/v3/search"
#     params = {'part': 'snippet', 'q': query, 'key': GOOGLE_API_KEY, 'type': 'video', 'maxResults': 1}
#     response = requests.get(search_url, params=params).json()
#     if 'items' in response and len(response['items']) > 0:
#         video = response['items'][0]
#         video_id = video['id']['videoId']
#         title = video['snippet']['title']
#         video_url = f"https://www.youtube.com/embed/{video_id}?autoplay=1"
#         return video_url, title
#     return None, "No video found."

# def search_movie_tmdb(query):
#     if not TMDB_API_KEY: return None, "Movie search not configured."
#     try:
#         search_url = f"https://api.themoviedb.org/3/search/movie"
#         params = {'api_key': TMDB_API_KEY, 'query': query}
#         response = requests.get(search_url, params=params)
#         search_data = response.json()
#         if search_data.get('results'):
#             movie = search_data['results'][0]
#             return f"https://multiembed.mov/?video_id={movie['id']}&tmdb=1", movie['title']
#         else:
#             return None, "No movie found."
#     except Exception:
#         return None, "Error connecting to TMDB."

# def capture_screen():
#     with mss.mss() as sct:
#         monitor = sct.monitors[1]
#         sct_img = sct.grab(monitor)
#         img_bytes = mss.tools.to_png(sct_img.rgb, sct_img.size)
#         return img_bytes

# # --- Page Routes ---
# @app.route('/dashboard')
# def dashboard(): return render_template('dashboard.html')

# @app.route('/login')
# def login_page(): return render_template('login.html')

# @app.route('/register')
# def register_page(): return render_template('register.html')

# @app.route('/')
# def index():
#     if 'username' not in session: return redirect(url_for('dashboard'))
#     return render_template('index.html')

# # --- User & Auth Routes ---
# @app.route('/user/create', methods=['POST'])
# def create_user():
#     username = request.json.get('username')
#     password = request.json.get('password')
#     success, message = user_manager.add_user(username, password)
#     if success:
#         session['username'] = username
#         user_manager.set_current_user(username)
#         return jsonify({"message": message, "username": username, "is_new_user": True})
#     return jsonify({"error": message}), 409

# @app.route('/user/login', methods=['POST'])
# def login_user():
#     username = request.json.get('username')
#     password = request.json.get('password')
#     if user_manager.check_password(username, password):
#         session['username'] = username
#         user_manager.set_current_user(username)
#         return jsonify({"message": "Login successful!", "username": username, "is_new_user": not user_manager.is_voice_enrolled(username)})
#     return jsonify({"error": "Invalid credentials"}), 401

# @app.route('/user/logout', methods=['POST'])
# def logout_user():
#     session.pop('username', None)
#     session.pop('history', None)
#     user_manager.set_current_user(None)
#     return jsonify({"message": "Logged out."})

# @app.route('/user/status', methods=['GET'])
# def user_status():
#     if 'username' in session:
#         return jsonify({"logged_in": True, "username": session['username'], "is_new_user": not user_manager.is_voice_enrolled(session['username'])})
#     return jsonify({"logged_in": False})

# @app.route('/user/welcome_message', methods=['GET'])
# def get_welcome_message():
#     if 'username' in session:
#         return jsonify({"type": "simple_text", "spoken_text": f"Welcome back, {session['username']}!"})
#     return jsonify({"error": "No user."}), 401

# # --- Face & Voice Routes ---
# @app.route('/face/recognize', methods=['POST'])
# def recognize_face_route():
#     name, confidence = face_recognizer.recognize_face(request.json.get('image_data'))
#     if name != "unrecognized":
#         session['username'] = name
#         user_manager.set_current_user(name)
#         return jsonify({"name": name, "confidence": confidence, "status": "success", "is_new_user": not user_manager.is_voice_enrolled(name)})
#     return jsonify({"name": "unrecognized", "status": "failure"})

# @app.route('/face/register', methods=['POST'])
# def register_face_route():
#     success, message = face_recognizer.save_face_sample(request.json.get('username'), request.json.get('image_data'))
#     return jsonify({"message": message} if success else {"status": message})

# @app.route('/face/train', methods=['POST'])
# def train_face_model_route():
#     success, message = face_recognizer.train_model()
#     return jsonify({"message": message} if success else {"error": message})

# @app.route('/voice/enroll', methods=['POST'])
# def enroll_voice_route():
#     if 'username' not in session: return jsonify({"error": "Not logged in"}), 401
#     audio_file = request.files.get('audio_data')
#     success, message = voice_authenticator.enroll_voice(session['username'], audio_file.read())
#     if success: user_manager.mark_voice_enrolled(session['username'])
#     return jsonify({"message": message})

# @app.route('/voice/recognize', methods=['POST'])
# def recognize_voice_route():
#     name, _ = voice_authenticator.recognize_voice(request.files.get('audio_data').read())
#     return jsonify({"name": name, "status": "recognized" if name == session.get('username') else "mismatch"})

# # --- ✅ LISTENING ROUTE (Uses Smart Model Selector) ---
# @app.route('/voice/listen', methods=['POST'])
# def listen_route():
#     if 'audio_data' not in request.files:
#         return jsonify({"status": "error", "message": "No audio"}), 400
    
#     audio_file = request.files['audio_data']
#     try:
#         audio_bytes = audio_file.read()
        
#         # ✅ Use the auto-selector to get a working model
#         model = get_working_model()
        
#         response = model.generate_content([
#             "Transcribe this audio. Return ONLY the spoken words as text. No explanation.",
#             {"mime_type": "audio/webm", "data": audio_bytes}
#         ])
        
#         text = response.text.strip()
#         print(f"🎤 Heard: {text}")
#         return jsonify({"status": "success", "text": text})

#     except Exception as e:
#         print(f"🔴 STT Error: {e}")
#         return jsonify({"status": "error", "message": "Listening failed."}), 500

# # --- CORE AI LOGIC (WITH RETRY) ---
# @app.route('/ask', methods=['POST'])
# def ask():
#     if 'username' not in session: return jsonify({"type": "simple_text", "spoken_text": "Login first."}), 401
    
#     user_input = request.json.get('prompt')
#     if not user_input: return jsonify({"error": "No prompt"}), 400
    
#     if 'history' not in session: session['history'] = []
#     history = session['history']
#     history_str = "\n".join([f"User: {h['prompt']}\nAI: {h['response']}" for h in history])
    
#     full_prompt = SYSTEM_PROMPT.format(conversation_history=history_str) + f"\n\nUser Prompt: \"{user_input}\"\n\nResponse JSON:"
    
#     try:
#         model = get_working_model()
        
#         # --- RETRY LOGIC FOR 429 ERRORS ---
#         response = None
#         for attempt in range(3): # Try up to 3 times
#             try:
#                 response = model.generate_content(full_prompt, generation_config=genai.types.GenerationConfig(response_mime_type="application/json"))
#                 break 
#             except Exception as e:
#                 print(f"⚠️ Attempt {attempt+1} failed: {e}")
#                 time.sleep(2)
        
#         if not response:
#             return jsonify({"type": "simple_text", "spoken_text": "I am currently overloaded. Please wait a moment."})

#         data = json.loads(clean_gemini_json_response(response.text))

#         # --- SPECIAL TWO-STAGE VISION LOGIC ---
#         if data.get("type") == "look_at_screen":
#             try:
#                 screen_bytes = capture_screen()
#                 vision_model = get_working_model()
                
#                 vision_prompt = """
#                 Analyze this screenshot. Return a JSON object with these keys:
#                 - 'app_name': (The name of the main active application)
#                 - 'status': (Short phrase describing the activity)
#                 - 'short_summary': (A 1-sentence casual summary for the avatar to speak immediately)
#                 - 'detailed_analysis': (A rich, multi-paragraph explanation of the code, text, or content on screen. Use bullet points if needed. This will be read when the user clicks 'Expand'.)
#                 """
                
#                 vis_resp = vision_model.generate_content(
#                     [vision_prompt, {"mime_type": "image/png", "data": screen_bytes}],
#                     generation_config=genai.types.GenerationConfig(response_mime_type="application/json")
#                 )
                
#                 vision_data = json.loads(clean_gemini_json_response(vis_resp.text))
#                 data["screen_data"] = vision_data 
#                 data["spoken_text"] = vision_data["short_summary"]
                
#             except Exception as e:
#                 print(f"Vision Error: {e}")
#                 data["spoken_text"] = "I couldn't analyze the screen."

#         # Handle History
#         if "spoken_text" in data:
#             history.append({"prompt": user_input, "response": data["spoken_text"]})
#             if len(history) > 4: history.pop(0)
#             session['history'] = history
        
#         # Handle Extras
#         if data.get("type") == "hologram_topic":
#             term = data.get("fallback_image_search")
#             if term: data["image_url"] = fetch_google_image_url(term)
        
#         elif data.get("type") == "change_background":
#             keyword = data.get("keyword")
#             bg_path = os.path.join(app.static_folder, 'backgrounds', f"{keyword}.png")
#             if os.path.exists(bg_path):
#                 data["image_url"] = f"/static/backgrounds/{keyword}.png"
#                 data["spoken_text"] = f"Going to {keyword}."
#             else:
#                 data = {"type": "simple_text", "spoken_text": f"Background {keyword} not found."}

#         elif data.get("type") == "play_movie":
#             url, title = search_movie_tmdb(data.get("movie_title"))
#             if url: 
#                 data["movie_url"] = url
#                 data["movie_title"] = title
#                 data["spoken_text"] = f"Playing {title}."
#             else: data = {"type": "simple_text", "spoken_text": "Movie not found."}

#         elif data.get("type") == "play_youtube":
#             url, title = search_youtube(data.get("search_query"))
#             if url:
#                 data["movie_url"] = url
#                 data["movie_title"] = title
#                 data["spoken_text"] = f"Playing {title}."
#             else: data = {"type": "simple_text", "spoken_text": "Video not found."}

#         elif data.get("type") == "get_weather":
#             return jsonify(get_weather(data["city"]))

#         return jsonify(data)

#     except Exception as e:
#         print(f"🔴 Error in /ask: {e}")
#         return jsonify({"type": "simple_text", "spoken_text": "I'm having trouble thinking."}), 500

# # --- Vision Routes ---
# @app.route('/describe-object', methods=['POST'])
# def describe_object_route():
#     try:
#         data = request.json.get('image_data').split(",", 1)[1]
#         model = get_working_model() 
#         response = model.generate_content(["Describe this.", {"mime_type": "image/jpeg", "data": data}])
#         return jsonify({"description": response.text})
#     except Exception: return jsonify({"error": "Failed"}), 500

# @app.route('/get_trivia_question', methods=['POST'])
# def get_trivia_question():
#     try:
#         model = get_working_model() 
#         resp = model.generate_content(f"Generate 1 trivia Q on {request.json.get('topic')} in JSON.", generation_config=genai.types.GenerationConfig(response_mime_type="application/json"))
#         return jsonify(json.loads(clean_gemini_json_response(resp.text)))
#     except Exception: return jsonify({"error": "Failed"}), 500

# @app.route('/analyze-environment', methods=['POST'])
# def analyze_environment_route():
#     if 'username' not in session: return jsonify({}), 401
#     try:
#         image_data = request.json.get('image_data').split(",", 1)[1]
#         model = get_working_model()
#         response = model.generate_content([
#             "Analyze this webcam frame. If something interesting changed, output JSON: {speak: true, text: 'observation', context: 'desc'}. Else {speak: false}.", 
#             {"mime_type": "image/jpeg", "data": image_data}
#         ])
#         return jsonify(json.loads(clean_gemini_json_response(response.text)))
#     except: return jsonify({"speak": False})

# if __name__ == '__main__':
#     app.run(debug=True, host='0.0.0.0', port=5000)



import os
import json
import random
import requests
from flask import Flask, render_template, request, jsonify, send_from_directory, session, redirect, url_for
import google.generativeai as genai
from dotenv import load_dotenv

# Import your user management and recognition modules
from user_manager import UserManager
from face_recognition_module import FaceRecognizer
from voice_recognition_module import VoiceAuthenticator

# --- Load Environment Variables ---
load_dotenv()

# --- Flask App Setup ---
app = Flask(__name__, template_folder='templates', static_folder='static')
app.secret_key = os.urandom(24)

# --- Configuration for API Endpoints (Unchanged) ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GOOGLE_CSE_ID = os.getenv("GOOGLE_CSE_ID")
TMDB_API_KEY = os.getenv("TMDB_API_KEY")

# --- Initialize Custom Modules (Unchanged) ---
print("Initializing backend services...")
user_manager = UserManager()
face_recognizer = FaceRecognizer(user_manager)
voice_authenticator = VoiceAuthenticator(user_manager)
print("✅ All services initialized.")

# --- Configure Google AI Client (Unchanged) ---
if not GEMINI_API_KEY:
    print("🔴 FATAL ERROR: GEMINI_API_KEY environment variable not set.")
else:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        print("✅ Google AI (Gemini) configured successfully.")
    except Exception as e:
        print(f"🔴 Error configuring Google AI client: {e}")

# --- System Prompt and Song Lyrics (Unchanged) ---
SYSTEM_PROMPT = """
You are the intelligent back-end for a 3D visual avatar. Your task is to analyze the user's prompt and respond with a single, clean JSON object.

Here are your response types, in order of priority:

1.  **"change_background"**: If the user wants to go to a specific place. Extract a single, simple, lowercase keyword.
    - User: "take me to the beach" -> {"type": "change_background", "keyword": "beach"}
    - User: "I want to see the Taj Mahal" -> {"type": "change_background", "keyword": "tajmahal"}

2.  **"get_weather"**: If the user asks for the weather. Extract the city name.
    - User: "what's the weather like in Pune?" -> {"type": "get_weather", "city": "Pune"}
    
3.  **"play_movie"**: If the user wants to watch a movie or film. Extract the movie name. If no name is provided, set movie_name to null.
    - User: "I want to watch the movie Fight Club" -> {"type": "play_movie", "movie_name": "Fight Club"}
    - User: "let's watch a film" -> {"type": "play_movie", "movie_name": null, "spoken_text": "Of course! What movie would you like to watch?"}

4.  **"start_trivia_game"**: If the user wants to play a game, especially trivia.
    - User: "let's play a game" -> {"type": "start_trivia_game", "spoken_text": "Great! Let's play some trivia. The game will appear on your screen now."}

5.  **"image_topic"**: For any informational question about a SINGLE specific, visual entity.
    - User: "who is the prime minister of india" -> {"type": "image_topic", "search_term": "Prime Minister of India Narendra Modi", "spoken_text": "As of my last update, the Prime Minister of India is Narendra Modi."}

6.  **"comparison_topic"**: If the user asks to compare two specific visual things.
    - User: "sun vs moon" -> {"type": "comparison_topic", "entities": [{"search_term": "The Sun star"}, {"search_term": "The Moon satellite"}], "spoken_text": "The Sun is a star, while the Moon is a satellite that orbits the Earth."}

7.  **"set_timer"**: If the user asks to set a timer. Convert the time to total seconds.
    - User: "set a timer for 2 minutes" -> {"type": "set_timer", "seconds": 120, "spoken_text": "Okay, timer set for 2 minutes."}

8.  **"open_camera"**: If the user asks to take a photo.
    - User: "take my photo" -> {"type": "open_camera", "intent": "save"}

9.  **"describe_object"**: If the user asks you to describe something they are showing you.
    - User: "tell me about this object" -> {"type": "describe_object", "spoken_text": "Okay, show me! I'll open the camera."}

10. **"animation_command"**: For simple commands like "dance", "jump", "walk".
    - User: "do a dance" -> {"type": "animation_command", "animation_name": "dance", "spoken_text": "Watch this!"}

11. **"math_sequence"**: For simple mathematical calculations.
    - User: "what is 5 plus 7" -> {"type": "math_sequence", "elements": ["5", "+", "7", "=", "12"], "spoken_text": "Five plus seven is twelve."}

12. **"sing_song"**: If the prompt includes "sing a song".
    - User: "sing me a song" -> {"type": "sing_song"}

13. **"simple_text"**: Your fallback for greetings, conversational filler, or abstract questions.
    - User: "hello" -> {"type": "simple_text", "spoken_text": "Hello there! How can I help you today?"}

Your primary goal is to correctly classify the user's intent.
"""

SONG_LYRICS = [
    "Twinkle, twinkle, little star, How I wonder what you are.",
    "Row, row, row your boat, Gently down the stream.",
]

# --- Helper Functions (Unchanged) ---
def get_weather(city):
    if not WEATHER_API_KEY:
        return {"type": "simple_text", "spoken_text": "I can't check the weather right now."}
        
    base_url = "http://api.openweathermap.org/data/2.5/weather"
    params = {'q': city, 'appid': WEATHER_API_KEY, 'units': 'metric'}
    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        weather_data = response.json()
        temp = round(weather_data['main']['temp'])
        description = weather_data['weather'][0]['description']
        return { "type": "weather_info", "city": city, "temp": temp, "description": description, "spoken_text": f"The current temperature in {city} is {temp} degrees Celsius with {description}." }
    except requests.exceptions.HTTPError as http_err:
        return {"type": "simple_text", "spoken_text": f"Sorry, I couldn't find a city named {city}."}
    except Exception as e:
        return {"type": "simple_text", "spoken_text": "I'm having trouble connecting to my weather station."}

def fetch_google_image_url(search_term):
    if not GOOGLE_API_KEY or not GOOGLE_CSE_ID: return None
    EXCLUDED_SITES = [ "alamy.com", "shutterstock.com", "istockphoto.com" ]
    exclusion_string = " ".join([f"-site:{site}" for site in EXCLUDED_SITES])
    full_search_term = f"{search_term} {exclusion_string}"
    try:
        url = "https://www.googleapis.com/customsearch/v1"
        params = { 'key': GOOGLE_API_KEY, 'cx': GOOGLE_CSE_ID, 'q': full_search_term, 'searchType': 'image', 'num': 1 }
        response = requests.get(url, params=params)
        response.raise_for_status()
        search_results = response.json()
        if 'items' in search_results and len(search_results['items']) > 0:
            return search_results['items'][0]['link']
        return None
    except Exception as e:
        print(f"🔴 An error occurred during Google image search: {e}")
        return None

# --- NEW & UPDATED: Page and Authentication Routes ---

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.route('/register')
def register_page():
    return render_template('register.html')

@app.route('/')
def index():
    # This is the main protected route. If the user is not in the session, redirect to the dashboard.
    if 'username' not in session:
        return redirect(url_for('dashboard'))
    return render_template('index.html')

# --- USER & RECOGNITION ROUTES (UPDATED for Session Logic) ---

@app.route('/user/create', methods=['POST'])
def create_user():
    username = request.json.get('username')
    password = request.json.get('password')
    success, message = user_manager.add_user(username, password)
    if success:
        # Automatically log in the user after successful registration
        session['username'] = username
        user_manager.set_current_user(username)
        # Indicate that this is a new user for frontend flow
        return jsonify({"message": message, "username": username, "is_new_user": True})
    else:
        return jsonify({"error": message}), 409

@app.route('/user/login', methods=['POST'])
def login_user():
    username = request.json.get('username')
    password = request.json.get('password')
    if user_manager.check_password(username, password):
        session['username'] = username # Store user in session upon successful login
        user_manager.set_current_user(username)
        is_new_user = not user_manager.is_voice_enrolled(username) # Check if voice enrolled
        return jsonify({"message": "Login successful!", "username": username, "is_new_user": is_new_user})
    return jsonify({"error": "Invalid username or password"}), 401

@app.route('/user/logout', methods=['POST'])
def logout_user():
    session.pop('username', None) # Clear the user from the session
    user_manager.set_current_user(None)
    return jsonify({"message": "User logged out successfully."})

@app.route('/user/status', methods=['GET'])
def user_status():
    if 'username' in session:
        username = session['username']
        is_new_user = not user_manager.is_voice_enrolled(username) # This means 'new' to voice enrollment
        return jsonify({"logged_in": True, "username": username, "is_new_user": is_new_user})
    return jsonify({"logged_in": False})

# NEW: Route to get a personalized welcome message for the logged-in user
@app.route('/user/welcome_message', methods=['GET'])
def get_welcome_message():
    if 'username' in session:
        username = session['username']
        return jsonify({"type": "simple_text", "spoken_text": f"Hello {username}! How can I help you today?", "username": username})
    return jsonify({"error": "No user logged in."}), 401


@app.route('/face/register', methods=['POST'])
def register_face_route():
    username = request.json.get('username')
    image_data = request.json.get('image_data')
    if not username or not image_data:
        return jsonify({"error": "Username and image data are required"}), 400
    success, message = face_recognizer.save_face_sample(username, image_data)
    if success:
        return jsonify({"message": message})
    return jsonify({"status": message}), 202

@app.route('/face/train', methods=['POST'])
def train_face_model_route():
    success, message = face_recognizer.train_model()
    if success:
        return jsonify({"message": message})
    return jsonify({"error": message}), 500

@app.route('/face/recognize', methods=['POST'])
def recognize_face_route():
    image_data = request.json.get('image_data')
    if not image_data:
        return jsonify({"error": "Image data is required"}), 400
    name, confidence = face_recognizer.recognize_face(image_data)
    if name != "unrecognized":
        session['username'] = name # LOG THE USER IN by setting the session
        user_manager.set_current_user(name)
        is_new_user = not user_manager.is_voice_enrolled(name)
        return jsonify({"name": name, "confidence": confidence, "status": "success", "is_new_user": is_new_user})
    return jsonify({"name": "unrecognized", "status": "failure"})

@app.route('/voice/enroll', methods=['POST'])
def enroll_voice_route():
    if 'username' not in session:
        return jsonify({"error": "User not logged in"}), 401
    name = session['username']
    audio_file = request.files.get('audio_data')
    if not audio_file:
        return jsonify({"error": "Audio data is required"}), 400
    success, message = voice_authenticator.enroll_voice(name, audio_file.read())
    if success:
        # Mark user as voice enrolled in user_manager after successful enrollment
        user_manager.mark_voice_enrolled(name) 
        return jsonify({"message": message})
    return jsonify({"error": message}), 500

@app.route('/voice/recognize', methods=['POST'])
def recognize_voice_route():
    if 'username' not in session:
        return jsonify({"name": "unrecognized", "status": "not_logged_in"})

    audio_file = request.files.get('audio_data')
    if not audio_file:
        return jsonify({"error": "Audio data is required"}), 400
        
    recognized_name, distance = voice_authenticator.recognize_voice(audio_file.read())
    
    if recognized_name == session['username']:
        return jsonify({"name": recognized_name, "status": "recognized"})
    else:
        return jsonify({"name": "unrecognized", "status": "mismatch"})

# --- CORE AI LOGIC (UPDATED for Session-based Personalization) ---
@app.route('/ask', methods=['POST'])
def ask():
    # Protected route: ensure user is logged in before processing AI requests
    if 'username' not in session:
        return jsonify({"type": "simple_text", "spoken_text": "Please log in to use the avatar."}), 401

    user_input = request.json.get('prompt')
    if not user_input:
        return jsonify({"error": "No prompt provided."}), 400

    print(f"➡️ Received prompt from {session['username']}: {user_input}")

    try:
        # --- Generate response from Gemini (Unchanged) ---
        full_prompt = f"{SYSTEM_PROMPT}\n\n---\n\nUser Prompt: \"{user_input}\"\n\nResponse JSON:"
        # ✅ FIXED: Using stable model name
        model = genai.GenerativeModel('gemini-2.5-flash')
        generation_config = genai.types.GenerationConfig(response_mime_type="application/json")
        response = model.generate_content(full_prompt, generation_config=generation_config)
        data = json.loads(response.text)

        # --- Post-processing Logic (Unchanged) ---
        if data.get("type") == "image_topic":
            search_term = data.get("search_term")
            if search_term:
                data["image_url"] = fetch_google_image_url(search_term) or "https://picsum.photos/220/220?grayscale"
        elif data.get("type") == "comparison_topic":
            for entity in data.get("entities", []):
                if entity.get("search_term"):
                    entity["image_url"] = fetch_google_image_url(entity["search_term"]) or "https://picsum.photos/220/220?grayscale"
        elif data.get("type") == "change_background":
            keyword = data.get("keyword")
            background_path = os.path.join(app.static_folder, 'backgrounds')
            found_image = next((f"/static/backgrounds/{keyword}{ext}" for ext in ['.png', '.jpg', '.jpeg', '.webp'] if os.path.exists(os.path.join(background_path, f"{keyword}{ext}"))), None)
            if found_image:
                data["image_url"] = found_image
                data["spoken_text"] = f"Of course! Let's go to the {keyword.replace('_', ' ')}."
            else:
                data = {"type": "simple_text", "spoken_text": f"Sorry, I don't have a scene for '{keyword}'."}
        elif data.get("type") == "get_weather":
            return jsonify(get_weather(data["city"])) if data.get("city") else jsonify({"type": "simple_text", "spoken_text": "Which city's weather?"})
        elif data.get("type") == "sing_song":
            data["spoken_text"] = "Sure! Here is a little song for you. " + random.choice(SONG_LYRICS)
        elif data.get("type") == "play_movie":
            movie_name = data.get("movie_name")
            if movie_name and TMDB_API_KEY:
                search_url = f"https://api.themoviedb.org/3/search/movie?api_key={TMDB_API_KEY}&query={movie_name}"
                try:
                    tmdb_response = requests.get(search_url).json()
                    if tmdb_response.get("results"):
                        movie_id = tmdb_response["results"][0]["id"]
                        movie_title = tmdb_response["results"][0]["title"]
                        data["movie_url"] = f"https://multiembed.mov/?video_id={movie_id}&tmdb=1"
                        data["movie_title"] = movie_title
                        data["spoken_text"] = f"Now playing {movie_title}."
                    else:
                        data = {"type": "simple_text", "spoken_text": f"Sorry, I couldn't find the movie {movie_name}."}
                except Exception as e:
                    print(f"🔴 Error fetching from TMDb: {e}")
                    data = {"type": "simple_text", "spoken_text": "I'm having trouble searching my movie database."}
            elif not TMDB_API_KEY:
                data = {"type": "simple_text", "spoken_text": "I can't search for movies right now, my movie database API key is missing."}

        # --- PERSONALIZATION (Updated to use session) ---
        current_user = session.get('username')
        if current_user and "spoken_text" in data:
            # Check for specific greetings or identity questions
            user_input_lower = user_input.lower()
            if "hello" in user_input_lower or "hi" in user_input_lower or "hey" in user_input_lower:
                data["spoken_text"] = f"Hello {current_user}! How can I assist you?"
            elif "who am i" in user_input_lower or "what is my name" in user_input_lower:
                data = {"type": "simple_text", "spoken_text": f"You are {current_user}. I remember you!"}
        
        print(f"⬅️ Sending Gemini response: {data}")
        return jsonify(data)
    
    except Exception as e:
        print(f"🔴 An error occurred in /ask route with Gemini: {e}")
        return jsonify({"type": "simple_text", "spoken_text": "Oh dear, my circuits are buzzing. Could you try that again?"}), 500


# --- Other Original Routes (Unchanged) ---
@app.route('/describe-object', methods=['POST'])
def describe_object_route():
    if not GEMINI_API_KEY:
        return jsonify({"error": "Google AI API key not configured"}), 500
    image_data_url = request.json.get('image_data')
    if not image_data_url:
        return jsonify({"error": "No image data provided"}), 400
    print("📸 Received image for Gemini description.")
    try:
        header, encoded_data = image_data_url.split(",", 1)
        mime_type = header.split(":")[1].split(";")[0]
        image_blob = {"mime_type": mime_type, "data": encoded_data}
        prompt_text = "Describe this object in a fun and engaging way for a student. Be enthusiastic! Keep it concise, under 50 words."
        # ✅ FIXED: Using stable model name
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content([prompt_text, image_blob])
        print(f"✅ Gemini Vision Response: {response.text}")
        return jsonify({"description": response.text})
    except Exception as e:
        print(f"🔴 An error occurred in /describe-object route with Gemini: {e}")
        return jsonify({"error": "Failed to process the image with Gemini."}), 500

@app.route('/get_trivia_question', methods=['POST'])
def get_trivia_question():
    if not GEMINI_API_KEY:
        return jsonify({"error": "AI brain is offline."}), 500
    try:
        topic = request.json.get('topic', 'General Knowledge')
        trivia_prompt = f"You are an AI quizmaster for students. Generate an age-appropriate trivia question for the topic '{topic}'. The response must be a single JSON object with keys: 'question', 'options' (an array of 4 strings), 'correct_answer' (one of the options), and 'fun_fact'."
        # ✅ FIXED: Using stable model name
        model = genai.GenerativeModel('gemini-2.5-flash')
        generation_config = genai.types.GenerationConfig(response_mime_type="application/json")
        response = model.generate_content(trivia_prompt, generation_config=generation_config)
        return jsonify(json.loads(response.text))
    except Exception as e:
        print(f"🔴 Error generating trivia question with Gemini: {e}")
        return jsonify({"error": "Could not generate a question."}), 500

# --- Main Entry Point ---
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)