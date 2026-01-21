import json
import os
from werkzeug.security import generate_password_hash, check_password_hash

class UserManager:
    """Manages user data, including passwords, friends, face, and voice enrollment."""
    def __init__(self, db_path='users.json'):
        self.db_path = db_path
        self.users = self._load_users()
        self.current_user = None # Tracks the currently recognized user for non-session logic

    def _load_users(self):
        """Loads user data from the JSON file."""
        if os.path.exists(self.db_path):
            with open(self.db_path, 'r') as f:
                try:
                    return json.load(f)
                except json.JSONDecodeError:
                    return {}
        return {}

    def _save_users(self):
        """Saves the current user data to the JSON file."""
        with open(self.db_path, 'w') as f:
            json.dump(self.users, f, indent=4)

    # --- MODIFIED FUNCTION ---
    def add_user(self, name, password, is_friend=False):
        """Adds a new user. If 'is_friend' is True, no password is required."""
        if name in self.users:
            # If we are trying to add a friend who already has a profile, that's okay.
            if is_friend:
                return True, f"User '{name}' already has a profile."
            return False, "User with that name already exists."
        
        # A normal user requires a password, a friend does not.
        if not is_friend and (not name or not password):
            return False, "Username and password are required for new users."
        if not name:
             return False, "Username is required."

        password_hash = None
        if password:
            password_hash = generate_password_hash(password)

        # Assign a new unique ID for the face recognizer
        face_id = max([-1] + [u.get('face_id', -1) for u in self.users.values()]) + 1
        
        self.users[name] = {
            "password_hash": password_hash,
            "face_id": face_id,
            "voice_enrolled": False,
            "friends": []  # Initialize an empty friends list for every new user/friend
        }
        self._save_users()
        print(f"Added new profile: {name} with Face ID: {face_id}")
        return True, f"User {name} created successfully."

    # --- NEW FUNCTION ---
    def add_friend(self, owner_username, friend_name):
        """Creates a friendship link between two users."""
        if owner_username in self.users and friend_name in self.users:
            # Ensure the friends list exists
            if 'friends' not in self.users[owner_username]:
                self.users[owner_username]['friends'] = []
            
            # Add friend if not already in the list to avoid duplicates
            if friend_name not in self.users[owner_username]['friends']:
                self.users[owner_username]['friends'].append(friend_name)
                self._save_users()
                print(f"✅ Friendship link created: {owner_username} is now friends with {friend_name}.")
                return True, "Friend added."
            return True, "Already friends."
        return False, "Owner or friend not found."

    # --- NEW FUNCTION ---
    def is_friend(self, owner_username, person_name):
        """Checks if person_name is in owner_username's friends list."""
        if owner_username in self.users:
            # .get('friends', []) safely returns the list or an empty one if key is missing
            return person_name in self.users[owner_username].get('friends', [])
        return False

    def check_password(self, name, password):
        """Verifies a user's password."""
        user = self.get_user_by_name(name)
        # A user must have a password hash to be able to log in
        if user and user.get("password_hash"):
            return check_password_hash(user["password_hash"], password)
        return False

    def get_user_by_name(self, name):
        """Retrieves a user's data by their name."""
        return self.users.get(name)

    def get_user_by_face_id(self, face_id):
        """Finds a username based on their face ID."""
        for name, data in self.users.items():
            if data.get('face_id') == face_id:
                return name
        return None
        
    def mark_voice_enrolled(self, name):
        """Updates a user's status to indicate voice enrollment is complete."""
        if name in self.users:
            self.users[name]['voice_enrolled'] = True
            self._save_users()
            print(f"Marked voice as enrolled for {name}.")

    def is_voice_enrolled(self, name):
        """Checks if a user has completed voice enrollment."""
        user = self.get_user_by_name(name)
        return user and user.get('voice_enrolled', False)

    def set_current_user(self, name):
        """Sets the active user for non-session-based logic."""
        if name in self.users or name is None:
            print(f"Session user set to: {name}")
            self.current_user = name
    
    def get_current_user(self):
        """Gets the active user for non-session-based logic."""
        return self.current_user