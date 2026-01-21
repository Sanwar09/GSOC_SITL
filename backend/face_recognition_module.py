# face_recognition_module.py

import cv2
import os
import numpy as np
import base64
import time 

class FaceRecognizer:
    """Handles face registration, training, and recognition."""
    def __init__(self, user_manager):
        self.user_manager = user_manager
        # NOTE: This code uses "faces" as the folder name. Ensure this matches everywhere.
        self.dataset_path = "faces" 
        self.model_path = "face_model.yml"
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        self.recognizer = cv2.face.LBPHFaceRecognizer_create()
        os.makedirs(self.dataset_path, exist_ok=True)
        if os.path.exists(self.model_path):
            try:
                self.recognizer.read(self.model_path)
                print("✅ Face recognition model loaded successfully.")
            except cv2.error as e:
                print(f"🔴 Error loading face model: {e}. It may be corrupted. Please retrain.")
                os.remove(self.model_path)


    def _convert_data_url_to_image(self, data_url):
        """Decodes a base64 image data URL into an OpenCV image."""
        try:
            encoded_data = data_url.split(',')[1]
            nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
            return cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        except Exception as e:
            print(f"🔴 Could not decode image data URL: {e}")
            return None

    def save_face_sample(self, name, image_data_url):
        """Saves face samples for a primary user."""
        user = self.user_manager.get_user_by_name(name)
        if not user:
            return False, "User not found."

        frame = self._convert_data_url_to_image(image_data_url)
        if frame is None:
            return False, "Invalid image data."
            
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # ✅ FIXED: Made the detector less strict to improve detection
        faces = self.face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4)

        if len(faces) == 0:
            return False, "No face detected in the frame."

        person_path = os.path.join(self.dataset_path, name)
        os.makedirs(person_path, exist_ok=True)
        
        count = len(os.listdir(person_path))
        if count >= 50: # Reduced sample count for faster registration
            return False, "Maximum samples collected for this user."

        (x, y, w, h) = faces[0]
        face_img = gray[y:y+h, x:x+w]
        
        # Save just one good sample per request for smoother progress
        cv2.imwrite(os.path.join(person_path, f"{int(time.time() * 1000)}.jpg"), face_img)

        return True, f"Saved sample {count + 1} for {name}."

    def save_friend_face_sample(self, owner_username, friend_name, image_data_url):
        """Saves face samples for a friend and registers them."""
        if not self.user_manager.get_user_by_name(friend_name):
            print(f"Friend '{friend_name}' not found. Creating a new profile.")
            self.user_manager.add_user(friend_name, None, is_friend=True)

        friend_user = self.user_manager.get_user_by_name(friend_name)
        if not friend_user:
            return False, "Could not create a profile for the friend."
        
        frame = self._convert_data_url_to_image(image_data_url)
        if frame is None:
            return False, "Invalid image data provided."
            
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # ✅ FIXED: Made the detector less strict to improve detection
        faces = self.face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4)

        if len(faces) == 0:
            return False, "No face detected. Please look directly at the camera."

        person_path = os.path.join(self.dataset_path, friend_name)
        os.makedirs(person_path, exist_ok=True)
        count = len(os.listdir(person_path))
        if count >= 50: # Reduced sample count
             return True, f"Already have enough samples for {friend_name}."

        (x, y, w, h) = faces[0]
        face_img = gray[y:y+h, x:x+w]
        
        # Save a good number of samples at once for friend registration
        num_samples_to_save = 20
        for i in range(num_samples_to_save):
            filename = f"{int(time.time() * 1000) + i}.jpg"
            cv2.imwrite(os.path.join(person_path, filename), face_img)
        
        self.user_manager.add_friend(owner_username, friend_name)

        print(f"✅ Saved {num_samples_to_save} samples for friend '{friend_name}' of '{owner_username}'.")
        return True, f"Face data for friend '{friend_name}' saved successfully."

    def train_model(self):
        """Trains the LBPH recognizer on all collected face samples."""
        print("⏳ Training face model...")
        faces, labels = [], []
        
        for person_name in os.listdir(self.dataset_path):
            person_path = os.path.join(self.dataset_path, person_name)
            if not os.path.isdir(person_path):
                continue

            user_data = self.user_manager.get_user_by_name(person_name)
            if not user_data:
                print(f"⚠️ Warning: No user data found for directory '{person_name}'. Skipping.")
                continue
            
            face_id = user_data['face_id']

            for img_name in os.listdir(person_path):
                img_path = os.path.join(person_path, img_name)
                img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
                if img is not None:
                    faces.append(img)
                    labels.append(face_id)
        
        if len(faces) < 2 or len(np.unique(labels)) < 1:
            return False, "Not enough data or users to train the model. Please add more face samples."

        self.recognizer.train(faces, np.array(labels))
        self.recognizer.write(self.model_path)
        print("✅ Training complete! Model saved.")
        return True, "Model trained successfully."

    def recognize_face(self, image_data_url):
        """Recognizes a face from a camera frame."""
        if not os.path.exists(self.model_path):
            return "unrecognized", 0.0

        frame = self._convert_data_url_to_image(image_data_url)
        if frame is None:
            return "unrecognized", 100.0

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # ✅ FIXED: Made the detector less strict to improve detection
        detected_faces = self.face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(30, 30))

        if len(detected_faces) == 0:
            return "unrecognized", 100.0
            
        for (x, y, w, h) in detected_faces:
            face_img = gray[y:y+h, x:x+w]
            try:
                label_id, confidence = self.recognizer.predict(face_img)
                
                # Confidence threshold: lower value means a better match
                if confidence < 80:
                    name = self.user_manager.get_user_by_face_id(label_id)
                    if name:
                        return name, round(confidence, 2)
            except cv2.error:
                continue

        return "unrecognized", 100.0