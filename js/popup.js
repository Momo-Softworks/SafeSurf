document.addEventListener('DOMContentLoaded', function() {
    let isAnimating = false;


  const thresholds = JSON.parse(localStorage.getItem('thresholds')) || {
      'Hentai': 0.08,
      'Porn': 0.20,
      'Sexy': 0.10,
  };

  const detectedImagesCount = localStorage.getItem('detectedImagesCount') || 0;
  document.getElementById('detectedImages').textContent = detectedImagesCount;

  const initializeThresholdControls = (type, initialThreshold) => {
    const range = document.getElementById(`${type.toLowerCase()}Range`);
    const input = document.getElementById(`${type.toLowerCase()}Input`);

    // Convert initial threshold to slider value and input field value
    range.value = initialThreshold * 100;
    input.value = (initialThreshold * 100).toFixed(2);

    const updateThresholdsInLocalStorage = (type, newValue) => {
        // Read the current thresholds from localStorage, or use the initial values if not set
        const currentThresholds = JSON.parse(localStorage.getItem('thresholds')) || thresholds;
        
        // Update the specific threshold value
        currentThresholds[type] = newValue;
        
        // Save the updated thresholds back to localStorage
        localStorage.setItem('thresholds', JSON.stringify(currentThresholds));
        
        // Notify the background script to reload the updated thresholds
        chrome.runtime.sendMessage({action: "updateThresholds"})
    };
    

    // Update localStorage and input field when slider value changes
    range.addEventListener('input', () => {
        const value = range.value / 100;
        updateThresholdsInLocalStorage(type, value);
        input.value = (value * 100).toFixed(2);
    });

    // Update localStorage and slider when input field value changes
    input.addEventListener('input', () => {
        let value = parseFloat(input.value) / 100;
        if (isNaN(value)) value = 0;
        updateThresholdsInLocalStorage(type, value);
        range.value = input.value;
    });
};


const whitelistInput = document.getElementById('whitelisted-sites');
const whitelistLabel = document.querySelector('label[for="whitelisted-sites"]');


const savedSites = localStorage.getItem('whitelistedSites');
if (savedSites) {
    whitelistInput.value = savedSites.split(',').map(site => site.trim()).join(', ');
    if (whitelistInput.value) {
        whitelistLabel.classList.add('active');
    }
}

whitelistInput.addEventListener('input', () => {
    const sites = whitelistInput.value.split(',')
                    .map(site => site.trim())
                    .filter(site => site.includes('.') && site !== '');

    localStorage.setItem('whitelistedSites', sites.join(', '));

    chrome.runtime.sendMessage({action: "updateWhitelistedSites"});

});


  // Initialize each threshold control
  Object.keys(thresholds).forEach(type => {
      initializeThresholdControls(type, thresholds[type]);
  });


  var elems = document.querySelectorAll('.tooltipped');
  var instances = M.Tooltip.init(elems, {
    enterDelay: 0,
    exitDelay: 200,
});



  document.addEventListener('keydown', event => {
    if (event.key === "g" && !isAnimating) {
        isAnimating = true;

        const egg = document.createElement('div');
        egg.classList.add('egg');

        document.body.appendChild(egg);
        
        egg.style.transition = "opacity 0.3s ease, transform 0.8s cubic-bezier(.33,.92,.36,.99)";
        
            setTimeout(() => {
                egg.style.opacity = '1';
                egg.style.transform = 'translate(-50%, -50%) scale(1.3)';
                
            }, 100);

            
            // Second animation step: fade out
            setTimeout(() => {
                egg.style.opacity = '0';
            }, 300);


        

        // Remove the image after animations
        setTimeout(() => {
            egg.remove();
            isAnimating = false;
        }, 1000);
    }
});



});


