import os
try:
    with open('conversation_history.txt', 'r') as file:
        print(file.read())
except Exception as e:
    print(f'Could not check for bugs. Error: {e}')