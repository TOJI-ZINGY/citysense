const map = L.map('map').setView([30.0444, 31.2357], 6);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

let activeCityName = null; 
let currentCityApiData = null; 

const yearSlider = document.getElementById("year-slider");
const yearLabel = document.getElementById("year-label");
const toggleBtn = document.getElementById("toggle-btn");
const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const sidebar = document.getElementById("sidebar");

function updateSidebarData(cityName, year) {
  if (!currentCityApiData || !currentCityApiData[year]) {
    console.warn(`No data available for ${cityName} in the year ${year}`);
    return;
  }
  
  const data = currentCityApiData[year];

  document.getElementById("population").innerHTML = `<i class="fa-solid fa-users"></i> Population: ${data.population}`;
  document.getElementById("temperature").innerHTML = `<i class="fa-solid fa-temperature-high"></i> Temperature: ${data.temp}`;
  document.getElementById("soil").innerHTML = `<i class="fa-solid fa-seedling"></i> Soil: ${data.soil}`;
  document.getElementById("vegetation").innerHTML = `<i class="fa-solid fa-tree"></i> Vegetation: ${data.vegetation}`;
  document.getElementById("pollution").innerHTML = `<i class="fa-solid fa-smog"></i> Pollution: ${data.pollution}`;
  document.getElementById("hazards").innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Hazards: ${data.hazards}`;
  document.getElementById('city-title').textContent = `${cityName} - ${year}`;
}

function searchForCity() {
  const locationQuery = searchInput.value.trim();
  if (!locationQuery) return;

  sidebar.classList.remove("show");

  fetch(`https://api.opencagedata.com/geocode/v1/json?q=${locationQuery}&key=b971ac4de6e1497da8606f92fdef45c9`)
    .then(response => response.json())
    .then(data => {
      if (data.results.length === 0) {
        alert("Location not found!");
        return;
      }

      const result = data.results[0];
      const lat = result.geometry.lat;
      const lng = result.geometry.lng;
      const officialCityName = result.components.city || result.components.town || locationQuery;

      map.setView([lat, lng], 10);
      L.marker([lat, lng]).addTo(map).bindPopup(officialCityName).openPopup();

       const backendApiUrl = `https://your-backend-api-url.com/citydata?lat=${lat}&lng=${lng}`; // Api
      
      fetch(backendApiUrl)
        .then(response => {
          if (!response.ok) {
            throw new Error('Detailed data not available for this location.');
          }
          return response.json();
        })
        .then(backendData => {
          activeCityName = officialCityName;
          currentCityApiData = backendData;

          const currentYear = yearSlider.value;
          updateSidebarData(activeCityName, currentYear);
          sidebar.classList.add("show");
        })
        .catch(error => {
          console.error("Backend Error:", error);
          alert(`Location found, but we don't have detailed data for "${officialCityName}".`);
        });

    })
    .catch(error => {
      console.error("Geocoding Error:", error);
      alert("An error occurred while searching for the location.");
    });
}

searchBtn.addEventListener("click", searchForCity);
searchInput.addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        searchForCity();
    }
});

yearSlider.addEventListener("input", function () {
  const year = this.value;
  yearLabel.textContent = year;
  if (activeCityName) { 
    updateSidebarData(activeCityName, year);
  }
});

toggleBtn.addEventListener("click", function () {
  if (!activeCityName) return; 
  const newYear = yearSlider.value === "2025" ? "2035" : "2025";
  yearSlider.value = newYear;
  yearLabel.textContent = newYear;
  updateSidebarData(activeCityName, newYear);
});

document.getElementById("chatbot-btn").addEventListener("click", () => {
  const chatWindow = document.getElementById("chatbot-window");
  chatWindow.style.display = chatWindow.style.display === "flex" ? "none" : "flex";
});
