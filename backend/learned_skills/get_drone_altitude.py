import RPi.GPIO as GPIO; import time; altitude = 20; print(altitude)

if __name__ == '__main__':
    try:
        while True:
            # Assuming you want to set drone to 50 meters, modify the following lines as needed
            if (GPIO.input(17) == 0):
                altitude = 50
                print('Altitude: ',altitude)
            else:
                print('Safety check: Altitude is at ',altitude,'meters')
    except KeyboardInterrupt:
        GPIO.cleanup()
