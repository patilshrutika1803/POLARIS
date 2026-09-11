# In their main app file (e.g., app.py)
from predict import predict_trajectory

# 1. Collect inputs from UI form/sliders
user_input = {
    'latitude': -76.85589, 'longitude': 168.52410, 'bottom_temp': -15.42,
    'top_temp': -13.43, 'humidity': 69.35, 'wind_speed': 4.28,
    'pressure': 982.79, 'solar': 505.15, 'snow_distance': 3.72,
    'hour_of_day': 1.0, 'day_of_year': 305, 'sin_hour': 0.2588,
    'cos_hour': 0.9659, 'displacement': 0.047, 'speed': 0.0506, 'bearing': 351.37
}

# 2. Call your function to get predicted coordinates
output = predict_trajectory(user_input)

# 3. Use output coordinates to draw on map or display on screen
print(output['6_hour']['latitude'], output['6_hour']['longitude'])