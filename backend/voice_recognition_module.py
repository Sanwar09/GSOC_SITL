# voice_recognition_module.py

import os
import numpy as np
import whisper
from sentence_transformers import SentenceTransformer
import faiss
from scipy.io.wavfile import read as read_wav
import io

class VoiceAuthenticator:
    """Handles voice enrollment and verification using Whisper and embeddings."""
    def __init__(self, user_manager):
        print("Loading voice authentication models...")
        self.user_manager = user_manager
        self.whisper_model = whisper.load_model("base")
        self.embedder = SentenceTransformer("all-MiniLM-L6-v2")
        
        # FAISS index setup
        self.embedding_dim = 384
        self.index = faiss.IndexFlatL2(self.embedding_dim)
        self.faiss_map = {} # Maps FAISS index to username
        self._load_existing_voices()
        print("✅ Voice models loaded.")
        
    def _load_existing_voices(self):
        """Loads voice embeddings of enrolled users into FAISS index."""
        # In a real app, you'd save/load embeddings from disk.
        # For simplicity, we assume they are lost on restart and need re-enrollment.
        print("FAISS index is ready. Enroll users to add voices.")

    def _get_embedding(self, text):
        """Converts text into a dense vector embedding."""
        emb = self.embedder.encode([text])
        return np.array(emb, dtype="float32")

    def enroll_voice(self, name, audio_bytes):
        """Enrolls a user by processing their voice recording."""
        if not self.user_manager.get_user_by_name(name):
            return False, "User does not exist."
            
        # Write bytes to a temporary file for Whisper
        temp_filename = f"{name}_enroll.wav"
        with open(temp_filename, 'wb') as f:
            f.write(audio_bytes)

        try:
            # Transcribe
            result = self.whisper_model.transcribe(temp_filename, fp16=False)
            transcript = result["text"].strip().lower()

            if not transcript:
                return False, "Could not understand audio. Please speak clearly."
            
            # Create and store embedding
            embedding = self._get_embedding(transcript)
            
            # Add to FAISS
            faiss_id = self.index.ntotal
            self.index.add(embedding)
            self.faiss_map[faiss_id] = name
            
            self.user_manager.mark_voice_enrolled(name)
            
            print(f"Enrolled '{name}' with transcript: '{transcript}'")
            return True, f"Voice profile created for {name}."
        finally:
            os.remove(temp_filename) # Clean up temp file

    def recognize_voice(self, audio_bytes):
        """Recognizes a user from a short voice clip."""
        if self.index.ntotal == 0:
            return "unrecognized", 100.0

        temp_filename = "temp_verify.wav"
        with open(temp_filename, 'wb') as f:
            f.write(audio_bytes)

        try:
            result = self.whisper_model.transcribe(temp_filename, fp16=False)
            transcript = result["text"].strip().lower()
            
            if not transcript:
                return "unrecognized", 100.0

            embedding = self._get_embedding(transcript)
            
            # Search FAISS for the closest match
            distances, indices = self.index.search(embedding, 1)
            
            match_index = indices[0][0]
            match_distance = distances[0][0]
            
            # Threshold for matching (you may need to tune this)
            if match_distance < 0.5:
                recognized_name = self.faiss_map.get(match_index)
                return recognized_name, match_distance
            
            return "unrecognized", match_distance
        finally:
            os.remove(temp_filename)

    def check_trigger_phrase(self, audio_bytes, trigger_phrase="hey buddy"):
        """Checks if a trigger phrase is present in the audio."""
        temp_filename = "temp_trigger.wav"
        with open(temp_filename, 'wb') as f:
            f.write(audio_bytes)
        try:
            result = self.whisper_model.transcribe(temp_filename, fp16=False)
            transcript = result["text"].strip().lower()
            print(f"Heard: '{transcript}'")
            return trigger_phrase in transcript
        finally:
            os.remove(temp_filename)