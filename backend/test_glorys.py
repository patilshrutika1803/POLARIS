import xarray as xr
from pathlib import Path

DATA_PATH = Path(__file__).parent / "data" / "GLORYS12.nc"

print("Loading GLORYS12...")
print("File:", DATA_PATH)

ds = xr.open_dataset(DATA_PATH)

print("\nGLORYS12 LOADED SUCCESSFULLY!")

print("\n--- Dataset dimensions ---")
print(ds.dims)

print("\n--- Variables ---")
print(list(ds.data_vars))

print("\n--- Coordinates ---")
print(list(ds.coords))

print("\n--- Required POLARIS variables ---")

for variable in ["uo", "vo", "siconc"]:
    if variable in ds:
        print(f"✓ {variable} found")
    else:
        print(f"✗ {variable} NOT FOUND")

print("\n--- Dataset preview ---")
print(ds)

ds.close()