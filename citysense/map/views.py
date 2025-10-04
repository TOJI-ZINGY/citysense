from django.shortcuts import render
from pathlib import Path
import pandas as pd

apikey = ""

def population():
    csv_path = Path(__file__).resolve().parent / 'data' / 'wadi_gedid_population.csv'
    df = pd.read_csv(csv_path)
    print(df.columns)
    
    
    
    

# Create your views here.
def giza(request, city):
    return render(request, "map/giza.html", {
        'city' : city,
        'apikey' : apikey
    })