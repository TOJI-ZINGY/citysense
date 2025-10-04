document.addEventListener('DOMContentLoaded', function() {
    // --- Globe Visualization with Three.js ---
    async function initMap() {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cityName)}&key={{ apikey }}`
      );
      const data = await response.json();

      if (data.status === "OK") {
        const location = data.results[0].geometry.location;
        const map = new google.maps.Map(document.getElementById("map"), {
          zoom: 10,
          center: location,
        });
        new google.maps.Marker({
          position: location,
          map: map,
          title: cityName,
        });
      } else {
        document.getElementById("map").innerText = "City not found.";
      }
    } catch (error) {
      console.error(error);
      document.getElementById("map").innerText = "Error loading map.";
    }
  }

    // --- Chatbot functionality ---
    const chatbotToggle = document.getElementById('chatbotToggle');
    const chatbotWindow = document.getElementById('chatbotWindow');
    const chatClose = document.getElementById('chatClose');
    const chatInput = document.getElementById('chatInput');
    const chatSend = document.getElementById('chatSend');
    const chatMessages = document.getElementById('chatMessages');
    const searchInput = document.querySelector('.search-input');

    chatbotToggle.addEventListener('click', () => {
        chatbotWindow.classList.toggle('active');
    });
    
    chatClose.addEventListener('click', () => {
        chatbotWindow.classList.remove('active');
    });
    
    function addMessage(text, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.classList.add(isUser ? 'user' : 'bot');
        messageDiv.textContent = text;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scroll to latest message
    }
    
    function sendMessage() {
        const message = chatInput.value.trim();
        if (message) {
            addMessage(message, true);
            chatInput.value = '';
            
            // Simulate AI response
            setTimeout(() => {
                const responses = [
                    "Based on current data, New York's temperature is expected to rise by 1.5°F over the next decade.",
                    "Urban expansion in this area has increased by 2.1% year-over-year, primarily in residential zones.",
                    "The vegetation index shows improvement in 3 of the 5 boroughs compared to last year.",
                    "Traffic density is highest in Manhattan during weekdays between 8-9 AM and 5-6 PM.",
                    "Air quality has improved by 8% since last year due to new environmental policies.",
                    "To predict future scenarios, I need more specific parameters. Could you elaborate on what you're interested in?",
                    "I can provide data on population growth, environmental risks, and urban expansion. Which one would you like to know more about?",
                    "For detailed insights, please specify the time frame or specific area within the city."
                ];
                
                const randomResponse = responses[Math.floor(Math.random() * responses.length)];
                addMessage(randomResponse);
            }, 1000);
        }
    }
    
    chatSend.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // --- Search functionality ---
    // This is a simplified simulation. In a real app, this would involve API calls.
    const cityData = {
        "new york": {
            name: "New York City",
            country: "United States",
            population: "8.4 million",
            temperature: "72°F",
            rainfall: "3.2 in",
            humidity: "65%",
            vegetation: "0.42",
            airQuality: "Moderate",
            soilType: "Loam",
            populationGrowth: "1.2%",
            trafficDensity: "High",
            urbanExpansion: "+2.1% YoY"
        },
        "london": {
            name: "London",
            country: "United Kingdom",
            population: "8.9 million",
            temperature: "60°F",
            rainfall: "2.5 in",
            humidity: "75%",
            vegetation: "0.55",
            airQuality: "Good",
            soilType: "Clay",
            populationGrowth: "0.8%",
            trafficDensity: "Very High",
            urbanExpansion: "+1.5% YoY"
        },
        "tokyo": {
            name: "Tokyo",
            country: "Japan",
            population: "14 million",
            temperature: "78°F",
            rainfall: "4.1 in",
            humidity: "70%",
            vegetation: "0.38",
            airQuality: "Moderate",
            soilType: "Volcanic",
            populationGrowth: "0.5%",
            trafficDensity: "High",
            urbanExpansion: "+0.9% YoY"
        }
    };

    function updateCityData(cityKey) {
        const data = cityData[cityKey.toLowerCase()];
        if (data) {
            document.getElementById('sidebar-city-name').textContent = data.name;
            document.getElementById('sidebar-city-country').textContent = data.country;
            document.getElementById('sidebar-population').textContent = data.population;
            document.getElementById('sidebar-temperature').textContent = data.temperature;
            document.getElementById('sidebar-rainfall').textContent = data.rainfall;
            document.getElementById('sidebar-humidity').textContent = data.humidity;
            document.getElementById('sidebar-vegetation').textContent = data.vegetation;
            document.getElementById('sidebar-air-quality').textContent = data.airQuality;
            document.getElementById('sidebar-soil-type').textContent = data.soilType;
            document.getElementById('sidebar-population-growth').textContent = data.populationGrowth;
            document.getElementById('sidebar-traffic-density').textContent = data.trafficDensity;
            document.getElementById('sidebar-urban-expansion').textContent = data.urbanExpansion;

            document.getElementById('metric-temperature').textContent = data.temperature;
            document.getElementById('metric-rainfall').textContent = data.rainfall;
            document.getElementById('metric-population').textContent = data.population.replace(' million', 'M'); // Simplified for metric card
            document.getElementById('metric-air-quality').textContent = data.airQuality === "Good" ? "25" : "42"; // Placeholder AQI
            
            addMessage(`Data for ${data.name} has been loaded. How can I assist you further?`);
        } else {
            alert("City data not found for your search. Try 'New York', 'London', or 'Tokyo'.");
            addMessage("I couldn't find data for that city. Please try 'New York', 'London', or 'Tokyo'.");
        }
    }

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const city = searchInput.value.trim();
            if (city) {
                updateCityData(city);
            }
        }
    });

    // Load default city data on page load
    updateCityData("New York");
});