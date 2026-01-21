import time
try:
    time.sleep(duration)
except:
    print('Timed out')
def set_timer(seconds):
    duration = seconds * 60
    print(f'Okay, timer set for {seconds} minutes.')
set_timer(2)