from services.environment import GLORYSEnvironment


print("Initializing GLORYS12 environment service...")

env = GLORYSEnvironment()

print("Environment service initialized successfully!")

# Test location inside the GLORYS12 grid
latitude = -62.31
longitude = 150.0

print("\nQuerying environment...")
print(f"Latitude: {latitude}")
print(f"Longitude: {longitude}")

result = env.get_environmental_data(latitude, longitude)

print("\n--- ENVIRONMENT RESULT ---")
print(result)