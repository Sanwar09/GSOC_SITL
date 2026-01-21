import time
try:
    duration = int(input('Set the timer in seconds: '))
time.sleep(duration)
except ValueError:
    print('Invalid input. Please enter a valid number.')
print(f'Timer set for {duration} seconds.')