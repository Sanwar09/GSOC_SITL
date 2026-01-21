import bluetooth; import time
print(bluetooth discoverable())
while True:
    if 'Drone' in bluetooth discoverable():
        print('Connected to drone')
        break
    else:
        print('Searching for drone...')
time.sleep(1)
