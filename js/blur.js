const injected_CSS = {
	"blurred-img": "img { filter: blur(30px); opacity: 1 !important; transition: filter 0.1s ease-in-out; }",
	"blurred-div": "div[style*='background-image'] { filter: blur(30px); }",
};

// Inject CSS for blurring immediately
const style = document.createElement("style");
document.documentElement.appendChild(style);
style.innerHTML = `${injected_CSS['blurred-img']} ${injected_CSS['blurred-div']}`;

let queue = [];
let processedURLs = new Set();
let srcToDOMObject = new Map();
let srcToPredictions = new Map();

let blurIdCounter = 0;

let modalInitialized = false;

let nsfwDetections = 0;

const processQueue = () => {
	// console.log(`Sending ${queue.length} images to the background script for processing.`)
	if (queue.length > 0) {
		chrome.runtime.sendMessage({
			action: 'queueImages',
			imageUrls: queue
		});
		queue.forEach(url => processedURLs.add(url));
		queue = [];
	}
};


const modal = document.createElement('section');

function injectScript(file, node) {
	var th = document.getElementsByTagName(node)[0];
	var s = document.createElement('script');
	s.setAttribute('type', 'text/javascript');
	s.setAttribute('src', file);
	th.appendChild(s);
}

document.addEventListener('DOMContentLoaded', () => {
  
	const addImageToQueue = (img, imgRect) => {
		let imageUrl;
		if (img.tagName === 'IMG') {
			imageUrl = img.src;
			
			if (!processedURLs.has(imageUrl) && !imageUrl.startsWith('https://ton.twitter') && !imageUrl.endsWith('.svg') && imageUrl.length > 4) {
				img.classList.remove('sfw-shown');
				  img.classList.add('nsfw-blur');
				queue.push(imageUrl);
				srcToDOMObject.set(imageUrl, img);
				processedURLs.add(imageUrl);
	
				const targetAncestor = findAppropriateAncestor(img, imgRect);
		
				if (targetAncestor) {
				  targetAncestor.addEventListener('mouseenter', () => {
					positionPopoverAndSetupToggle(img, targetAncestor);
				  });
				} else {
				  img.addEventListener('mouseenter', () => {
					positionPopoverAndSetupToggle(img);
				  });
				}
			}
			else{
				img.classList.remove('nsfw-blur');
				img.classList.add('sfw-shown');
			}
		} 
		else {
			let backgroundImageString = img.style.backgroundImage;
			// Split and extract URLs
			let urls = backgroundImageString.split(/\),\s*/).map(part => {
				if (!part.endsWith(')')) {
					part += ')';
				}
				return part.replace(/url\((['"]?)(.*?)\1\)/gi, '$2').trim().replace(/&quot;/g, '"').replace(/&amp;/g, '&');
			});
	
			urls.forEach(imageUrl => {
				if (!processedURLs.has(imageUrl) || !imageUrl.endsWith('.svg') && imageUrl.length > 4) {
					img.classList.remove('sfw-shown');
					img.classList.add('nsfw-blur');
					srcToDOMObject.set(imageUrl, img);
					processedURLs.add(imageUrl);
					queue.push(imageUrl);
	
					const imgRect = img.getBoundingClientRect();
					const targetAncestor = findAppropriateAncestor(img, imgRect);
			
					if (targetAncestor) {
					  targetAncestor.addEventListener('mouseenter', () => {
						positionPopoverAndSetupToggle(img, targetAncestor);
					  });
					} else {
					  img.addEventListener('mouseenter', () => {
						positionPopoverAndSetupToggle(img);
					  });
					}
	
				}
				else{
					img.classList.remove('nsfw-blur');
					img.classList.add('sfw-shown');
				}
			});
	
			// if (urls.length > 0) {
			// 	console.log(`Background images found: \n ${urls.join('\n ')} \n from background image ${backgroundImageString}`);
			// }
		}
	};
	
	
	function findAppropriateAncestor(img, imgRect) {
		let elem = img;
	
		while (elem.parentElement && !elem.parentElement.matches('body')) {
			const parent = elem.parentElement;
			const parentRect = parent.getBoundingClientRect();
	
			if (parentRect.width == imgRect.width && parentRect.height == imgRect.height) {
				const aTag = parent.querySelector('a');
				if (aTag && parent.tagName !== 'A') {
					return aTag;
				}
			} else { //When the parent's w or h is greather than image's
				break;
			}
	
			elem = parent;
		}
	
		return false;
	}



  	processInitialImagesAndDivs();

	function processInitialImagesAndDivs() {
		const images = document.querySelectorAll('img');
		const divsWithBackgroundImage = document.querySelectorAll('div[style*="background-image"]');

		const assignBlurIdsAndBlurInitial = (images) => {
			images.forEach(img => {
				const imgRect = img.getBoundingClientRect();
				if (!img.hasAttribute('data-blur-id') && (!imgRect.width < 64 || !imgRect.height < 64)) {
				const blurId = `blur-div-${blurIdCounter++}`;
				img.setAttribute('data-blur-id', blurId);

				addImageToQueue(img, imgRect)

				} 
				else {
					img.classList.add('sfw-shown');
				}
			});
	
		};

		assignBlurIdsAndBlurInitial(images);
		assignBlurIdsAndBlurInitial(divsWithBackgroundImage);

		if (queue.length > 0) {
			processQueue();
		}
	}

	// Create popover and the important components
	const popover = document.createElement('div');
	popover.classList.add('nsfwPopover', 'hidePopover');
	popover.style.visibility = 'hidden';

	const sliderContainer = document.createElement('div');
	sliderContainer.id = 'sliderContainer';
	sliderContainer.innerHTML = 
	`
		  <div class="tick-slider">
					  
			  
			  <div class="tick-slider-value-container">
				  
				  <div id="blurLabel" class="tick-slider-label">
					  <svg id="blurIcon" class="w-6 h-6 text-gray-800 dark:text-white" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="34" height="34" fill="none" viewBox="0 0 24 24">
						  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.933 13.909A4.357 4.357 0 0 1 3 12c0-1 4-6 9-6m7.6 3.8A5.068 5.068 0 0 1 21 12c0 1-3 6-9 6-.314 0-.62-.014-.918-.04M5 19 19 5m-4 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
					  </svg>
				  </div>
				  
				  <div id="weightValue" class="tick-slider-value"></div>
			  </div>
			  <div class="tick-slider-background"></div>
			  <div id="weightProgress" class="tick-slider-progress"></div>
			  <div id="weightTicks" class="tick-slider-tick-container"></div>
			  <input
				  id="weightSlider"
				  class="tick-slider-input"
				  type="range"
				  min="0"
				  max="100"
				  step="10"
				  value="100"
				  data-tick-step="10"
				  data-tick-id="weightTicks"
				  data-value-id="weightValue"
				  data-progress-id="weightProgress"
				  data-handle-size="18"
				  data-min-label-id="weightLabelMin"
				  data-max-label-id="weightLabelMax"
			  />
		  </div>
	`;

	const fabContainer = document.createElement('div');
	fabContainer.className = 'fab-container';
	const infoBtn = document.createElement('button');
	infoBtn.className = 'nsfw-fab';
	infoBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" id="question-mark"><g data-name="Layer 2"><g data-name="question-mark"><rect width="24" height="24" opacity="0" transform="rotate(180 12 12)"></rect><path d="M17 9A5 5 0 0 0 7 9a1 1 0 0 0 2 0 3 3 0 1 1 3 3 1 1 0 0 0-1 1v2a1 1 0 0 0 2 0v-1.1A5 5 0 0 0 17 9z"></path><circle cx="12" cy="19" r="1"></circle></g></g></svg>`
	infoBtn.addEventListener('click', () => {
		modal.classList.remove('hidden-modal');
		modal.style.visibility = 'visible';
		modal.classList.add('shown-modal');
	});
	fabContainer.appendChild(infoBtn);

	popover.appendChild(sliderContainer);
	popover.appendChild(fabContainer);

	modal.id = 'nsfw-modal';
	modal.style.visibility = 'hidden';
	modal.classList.add('hidden-modal');
	modal.innerHTML = ``

	document.body.appendChild(popover);
	document.body.appendChild(modal);


	//image hovered over is passed in
	function positionPopoverAndSetupToggle(img, ancestor = null) {
		const rect = img.getBoundingClientRect();
		const sliderContainer = popover.querySelector("#sliderContainer");
		const fabContainer = popover.querySelector(".fab-container");
		const blurBtn = document.getElementById("blurLabel");
		popover.style.maxWidth = `${rect.width+50}px`;
		sliderContainer.style.maxWidth = `${rect.width}px`;


		if(img.classList.contains('nsfw-blur')){
			fabContainer.style.top = `${(rect.height/2 + 36)}px`;
			fabContainer.style.right = `${(rect.width / 2) + 17}px`;
			blurBtn.style.right = `0px`;
			
		}
		else{
			fabContainer.style.top = `10px`;
			fabContainer.style.right = `${(rect.width / 2) - 6}px`;
			blurBtn.style.right = `25px`;
		}
		
		
		console.log(rect.height)

		// Align left edge of the popover with the left edge of the image
		const popoverX = rect.left - 20;
		// Directly above the image
		const popoverY = window.scrollY + rect.top - 68;
		popover.style.left = `${popoverX}px`;
		popover.style.top = `${popoverY}px`;

		updateSliderForNewImage(img);
		initSlider(img);

		popover.style.visibility = 'visible';
		popover.classList.remove('hidePopover');
		popover.classList.add('showPopover');

		let timeoutId;

		const removeListenersAndHidePopover = () => {
			popover.classList.remove('showPopover');
			popover.classList.add('hidePopover');

			// Remove listeners here
			const weightSlider = document.getElementById("weightSlider");
			const blurBtn = document.getElementById("blurLabel");

			if (weightSlider._currentListener) {
				weightSlider.removeEventListener('input', weightSlider._currentListener);
			}
			if (blurBtn._currentListener) {
				blurBtn.removeEventListener('click', blurBtn._currentListener);
			}
		};

		if (ancestor !== null) {
			ancestor.addEventListener('mouseleave', () => {
				timeoutId = setTimeout(removeListenersAndHidePopover, 20);
			});
		} else {
			img.addEventListener('mouseleave', () => {
				timeoutId = setTimeout(removeListenersAndHidePopover, 20);
			});
		}

		popover.addEventListener('mouseenter', () => {
			clearTimeout(timeoutId);
		});

		popover.addEventListener('mouseleave', () => {
			removeListenersAndHidePopover();
		});

		//It would be a js developer moment to do this on every "isNSFW" call.
    //It takes forever to communicate between scripts, and this is already slow enough as it is. 
		if (nsfwDetections > 0) {
			chrome.runtime.sendMessage({
				action: 'incrementCount',
				amount: nsfwDetections
			});
			nsfwDetections = 0;
		}
	};

	const assignBlurIdsAndBlur = (images) => {

		images.forEach(img => {
			const imgRect = img.getBoundingClientRect();
			if (!Array.from(img.classList).some(className => className.startsWith('imagePlaceholder')) && !img.hasAttribute('data-blur-id') && (!imgRect.width < 64 || !imgRect.height < 64)) {
				const blurId = `blur-div-${blurIdCounter++}`;
				img.setAttribute('data-blur-id', blurId);

				addImageToQueue(img, imgRect);
			} else {
				img.classList.add('sfw-shown');
			}
		});

		if (queue.length > 0) {
			processQueue();
		}
	};



	const observerCallback = (mutationsList, observer) => {
		for (let mutation of mutationsList) {
			if (mutation.type === 'childList' && mutation.addedNodes.length) {
				const relevantNodes = [];
				mutation.addedNodes.forEach(node => {
					if (node.nodeType === Node.ELEMENT_NODE) {
						if (node.tagName === 'IMG' || node.style?.backgroundImage) {
							relevantNodes.push(node);
						} else {
							// Query for nested images or divs with background images within the added node
							const nestedImages = node.querySelectorAll('img, div[style*="background-image"]');
							if (nestedImages.length > 0) {
								relevantNodes.push(...nestedImages);
							}
						}
					}
				});

				if (relevantNodes.length) {
					assignBlurIdsAndBlur(relevantNodes);
				}
			}
		}
	};


	const observer = new MutationObserver(observerCallback);
	const config = {
		childList: true,
		subtree: true
	};
	observer.observe(document.body, config);

	//For the buttons in the modal
	injectScript('https://cdn.jsdelivr.net/npm/mo-js@0.288.2/build/mo.min.js', 'body');
	injectScript('https://cdn.jsdelivr.net/npm/mojs-curve-editor@1.5.0/app/build/mojs-curve-editor.min.js', 'body');




});

function isImageNSFW(predictions) {
	return predictions.some(prediction => prediction.probability > nsfwThresholds[prediction.className]);
}

function getFullComparison(predictions) {
	let thresholdExceedanceMap = {};

	predictions.forEach(prediction => {
		thresholdExceedanceMap[prediction.className] = prediction.probability > nsfwThresholds[prediction.className];
	});

	return thresholdExceedanceMap;
}


function processClassificationResult(result) {
	const imageUrl = result.imageUrl;
	const imgElem = srcToDOMObject.get(imageUrl);
	const predictions = result.predictions;

	srcToPredictions.set(imageUrl, predictions);
  if (!isImageNSFW(predictions)) {
    imgElem.classList.remove('nsfw-blur');
    imgElem.classList.add('sfw-shown');
  } else {
    nsfwDetections++;
  }



}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
	if (message.action === 'classificationResult') {
		processClassificationResult(message.result);
	}
});

const updateSliderForNewImage = (img) => {
	const weightSlider = document.getElementById("weightSlider");
	const blurClassPrefix = "blurred";

	if (img.classList.contains("sfw-shown")) {
		weightSlider.value = 0;
	} else {
		let blurValue = 100;
		const blurClass = Array.from(img.classList).find(c => c.startsWith(blurClassPrefix));

		if (blurClass) {
			const blurAmount = parseInt(blurClass.substring(blurClassPrefix.length), 10);
			blurValue = (blurAmount / 30) * 100;
		}

		weightSlider.value = blurValue;
	}

	weightSlider.dispatchEvent(new Event('input'));
};


function initSlider(img) {
	const weightSlider = document.getElementById("weightSlider");
	const blurBtn = document.getElementById("blurLabel");
	const sliders = document.getElementsByClassName("tick-slider-input");

	for (let slider of sliders) {
		slider.oninput = onSliderInput;

		//Called initially
		updateValuePosition(slider);
		updateProgress(slider);
		setTicks(slider);
		updateImage(slider);
	}

	const inputListener = function() {
		const blurValue = (this.value / 100) * 30;
		img.className =(`blurred${blurValue}`);
	};

	const btnListener = function() {
		//If it's fully blurred, button should unblur it.
		if(img.classList.contains('nsfw-blur') || img.classList.contains('blurred30')){
			img.className = 'blurred0';
			weightSlider.value = weightSlider.min;
			triggerSliderUpdate(weightSlider);
		}
		//Otherwise, we fully blur it.
		else{
			img.className = 'blurred30';
			weightSlider.value = weightSlider.max;
			triggerSliderUpdate(weightSlider);
		}
	}

	prepareModal(img)

	weightSlider.addEventListener('input', inputListener);
	blurBtn.addEventListener('click', btnListener);

	// Store references to the new listeners for removal later
	weightSlider._currentListener = inputListener;
	blurBtn._currentListener = btnListener;
}

function triggerSliderUpdate(slider) {
	onSliderInput({
		target: slider
	});
}

function onSliderInput(event) {
	updateValuePosition(event.target);
	updateProgress(event.target);
	updateImage(event.target);
}

function updateValuePosition(slider) {
	let value = document.getElementById(slider.dataset.valueId);

	const percent = getSliderPercent(slider);

	const sliderWidth = slider.getBoundingClientRect().width;
	const valueWidth = value.getBoundingClientRect().width;
	const handleSize = slider.dataset.handleSize;

	let left = percent * (sliderWidth - handleSize) + handleSize / 2 - valueWidth / 2;

	left = Math.min(left, sliderWidth - valueWidth);
	left = slider.value === slider.min ? 0 : left;

	value.style.left = left + "px";

}


function updateProgress(slider) {
	let progress = document.getElementById(slider.dataset.progressId);
	const percent = getSliderPercent(slider);

	progress.style.width = percent * 100 + "%";
	//blurAmt = blur * percent
}

function getSliderPercent(slider) {
	const range = slider.max - slider.min;
	const absValue = slider.value - slider.min;

	return absValue / range;
}

function setTicks(slider) {
	let container = document.getElementById(slider.dataset.tickId);
	container.innerHTML = '';
	const spacing = parseFloat(slider.dataset.tickStep);
	const sliderRange = slider.max - slider.min;
	const tickCount = sliderRange / spacing + 1; // +1 to account for 0

	for (let ii = 0; ii < tickCount; ii++) {
		let tick = document.createElement("span");

		tick.className = "tick-slider-tick";

		container.appendChild(tick);
	}
}


function updateImage(slider){

	const isAtMin = slider.value == slider.min;
	const isAtMax = slider.value == slider.max;

	const blurIcon = document.getElementById("blurIcon")

	if (isAtMax) {
		blurIcon.innerHTML = `
		<path stroke="currentColor" stroke-width="2" d="M21 12c0 1.2-4.03 6-9 6s-9-4.8-9-6c0-1.2 4.03-6 9-6s9 4.8 9 6Z"/>
		<path stroke="currentColor" stroke-width="2" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>	
		`;
	} else {
		blurIcon.innerHTML = `
		<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.933 13.909A4.357 4.357 0 0 1 3 12c0-1 4-6 9-6m7.6 3.8A5.068 5.068 0 0 1 21 12c0 1-3 6-9 6-.314 0-.62-.014-.918-.04M5 19 19 5m-4 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>

		`;
	}

}

function onResize() {
	const sliders = document.getElementsByClassName("tick-slider-input");

	for (let slider of sliders) {
		updateValuePosition(slider);
	}
}

function prepareModal(img) {
	const modal = document.getElementById('nsfw-modal');
	const predictions = srcToPredictions.get(img.src);
  let pornBool
  let hentaiBool
  let sexyBool
  let pornPrediction
  let hentaiPrediction
  let sexyPrediction
	
  if (predictions){
    const comparisonMap = getFullComparison(predictions);
    pornBool = comparisonMap['Porn'];
    hentaiBool = comparisonMap['Hentai'];
    sexyBool = comparisonMap['Sexy'];
    pornPrediction = (parseFloat(predictions.find(prediction => prediction.className === 'Porn')?.probability.toFixed(5) || 0)) * 100;
    hentaiPrediction = (parseFloat(predictions.find(prediction => prediction.className === 'Hentai')?.probability.toFixed(5) || 0)) * 100;
    sexyPrediction = (parseFloat(predictions.find(prediction => prediction.className === 'Sexy')?.probability.toFixed(5) || 0)) * 100;
  }
  else{
    pornBool = false;
    hentaiBool = false;
    sexyBool = false;
    pornPrediction = 'Unknown';
    hentaiPrediction = 'Unknown';
    sexyPrediction = 'Unknown';
  }

	let pornThreshold = (nsfwThresholds.Porn) * 100;
	let hentaiThreshold = (nsfwThresholds.Hentai) * 100;
	let sexyThreshold = (nsfwThresholds.Sexy) * 100;

	modal.innerHTML = `
<div class="modal-close">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" id="close">
  <path d="M13.41,12l6.3-6.29a1,1,0,1,0-1.42-1.42L12,10.59,5.71,4.29A1,1,0,0,0,4.29,5.71L10.59,12l-6.3,6.29a1,1,0,0,0,0,1.42,1,1,0,0,0,1.42,0L12,13.41l6.29,6.3a1,1,0,0,0,1.42,0,1,1,0,0,0,0-1.42Z"></path>
</svg>
</div>

<main class="nsfw-row nsfw-title">
<ul>
  <li>Classification</li>
  <li>User Threshold</li>
  <li>Model Prediction</li>
  <li>Result</li>
</ul>
</main>

<article class="nsfw-row ${pornBool ? 'nsfw-detected' : 'nsfw-not'}">
<ul>
  <li><a href="#">Porn</a></li>
  <li class="code-text">${pornThreshold}%</li>
  <li class="code-text">${pornPrediction}%</li>
  <li>${pornBool ? '✅' : '❌'}</li>
</ul>
<ul class="more-content">

  <div class="nsfw-btn-container" 
  data-src="${encodeToBase64(img.src)}" 
  data-classification="porn"  
  data-report-type="${pornBool ? 'positive' : 'negative'}" 
  data-threshold="${pornThreshold}%" 
  data-prediction="${pornPrediction}%">

      <span class="nsfw-btn-text">REPORT FALSE ${pornBool ? 'POSITIVE' : 'NEGATIVE'}</span>
      <div class="checkmark"></div>
    </div>

  <li>TIP: Pin the extension in your browser's extension menu for easy adjustments.</li>
</ul>
</article>

<article class="nsfw-row ${hentaiBool ? 'nsfw-detected' : 'nsfw-not'}">
<ul>
  <li><a href="#">Hentai</a></li>
  <li class="code-text">${hentaiThreshold}%</li>
  <li class="code-text">${hentaiPrediction}%</li>
  <li>${hentaiBool ? '✅' : '❌'}</li>
</ul>
<ul class="more-content">

<div class="nsfw-btn-container" 
data-src="${encodeToBase64(img.src)}" 
data-classification="hentai"  
data-report-type="${hentaiBool ? 'positive' : 'negative'}" 
data-threshold="${hentaiThreshold}%" 
data-prediction="${hentaiPrediction}%">

      <span class="nsfw-btn-text">REPORT FALSE ${hentaiBool ? 'POSITIVE' : 'NEGATIVE'}</span>
      <div class="checkmark"></div>
    </div>

  <li>TIP: Pin the extension in your browser's extension menu for easy adjustments.</li>

</ul>
</article>

<article class="nsfw-row ${sexyBool ? 'nsfw-detected' : 'nsfw-not'}">
<ul>
  <li><a href="#">Sexy</a></li>
  <li class="code-text">${sexyThreshold}%</li>
  <li class="code-text">${sexyPrediction}%</li>
  <li>${sexyBool ? '✅' : '❌'}</li>
</ul>
<ul class="more-content">
  
<div class="nsfw-btn-container" 
data-src="${encodeToBase64(img.src)}" 
data-classification="sexy"  
data-report-type="${sexyBool ? 'positive' : 'negative'}" 
data-threshold="${sexyThreshold}%" 
data-prediction="${sexyPrediction}%">
      <span class="nsfw-btn-text">REPORT FALSE ${sexyBool ? 'POSITIVE' : 'NEGATIVE'}</span>
      <div class="checkmark"></div>
    </div>

  <li>TIP: Pin the extension in your browser's extension menu for easy adjustments.</li>
</ul>
</article>
`
	injectMojs();

	document.querySelectorAll('.nsfw-btn-container').forEach(element => {
		element.addEventListener('click', function() {
			sendReport(this);
		});
	});



	(function() {
		function draggable(selector, options) {
			const elements = document.querySelectorAll(selector);
			let isDragging = false;

			function applyCursorStyle(style) {
				document.body.style.cursor = style;
				elements.forEach(el => {
					el.style.cursor = style;
				});
			}

			function onDragStart(e, el) {
				if (!el) return;
				if (e.target.matches('.modal-close, .modal-close *') || (options.handle && !e.target.matches(options.handle + ', ' + options.handle + ' *'))) {
					return;
				}

				isDragging = true;
				const rect = el.getBoundingClientRect();
				el.setAttribute('data-start-x', e.clientX - rect.left);
				el.setAttribute('data-start-y', e.clientY - rect.top);
				el.style.position = 'fixed'; // Use 'fixed' positioning to account for scrolling

				applyCursorStyle('move');

				document.addEventListener('mousemove', onDragMove.bind(this, el));
				document.addEventListener('mouseup', onDragEnd.bind(this, el), {
					once: true
				});
			}

			function onDragMove(el, e) {
				if (!isDragging) return;

				let startX = parseInt(el.getAttribute('data-start-x'), 10);
				let startY = parseInt(el.getAttribute('data-start-y'), 10);
				el.style.left = `${e.clientX - startX}px`;
				el.style.top = `${e.clientY - startY}px`;
			}

			function onDragEnd(el) {
				isDragging = false;
				applyCursorStyle('');

				el.removeAttribute('data-start-x');
				el.removeAttribute('data-start-y');
				document.removeEventListener('mousemove', onDragMove);
			}

			elements.forEach((el) => {
				el.addEventListener('mousedown', (e) => onDragStart(e, el));
				if (options.handle) {
					const handle = el.querySelector(options.handle);
					if (handle) {
						handle.style.cursor = 'move';
					}
				} else {
					el.style.cursor = 'move';
				}
			});
		}

		window.drags = draggable;
	})();

	drags('#nsfw-modal', {
		handle: ".nsfw-title"
	});


	function handleEscapeKeyPress(event) {
		if (event.key === "Escape") {
			closeModal();
		}
	}

	function closeModal() {
		;
		if (!modal.classList.contains('hidden-modal')) {
			modal.classList.remove('shown-modal')
			modal.classList.add('hidden-modal');
			setTimeout(() => {
				modal.style.visibility = 'hidden';
			}, 300);

		}
	}

	document.addEventListener('keydown', handleEscapeKeyPress);

	document.querySelector('.modal-close').addEventListener('click', function() {
		closeModal();
	});

}

function sendReport(element) {

	function decodeFromBase64(base64Str) {
		const decoder = new TextDecoder();
		const bytes = Uint8Array.from(atob(base64Str), c => c.charCodeAt(0));
		return decoder.decode(bytes);
	}


	const src = decodeFromBase64(element.dataset.src);
	const classificationType = element.dataset.classification;
	const reportType = element.dataset.reportType;
	const threshold = element.dataset.threshold;
	const prediction = element.dataset.prediction;
	console.log(`Sending report for ${classificationType} with a false ${reportType} report.`)

	chrome.runtime.sendMessage({
		action: 'sendReport',
		payload: {
			src,
			classificationType,
			reportType,
			threshold,
			prediction
		}
	});

}

function injectMojs() {
	const code = `
    (function() {
      // Check and define RADIUS if not already defined
      if (typeof window.RADIUS === 'undefined') {
        window.RADIUS = 28;
      }

      // Use a global flag to check if the custom shape has been added
      if (!window.customShapeCheckAdded) {
        class Check extends mojs.CustomShape {
          getShape() {
            return '<path transform-origin: 50% 50% 0px; stroke-linecap="square" d="M3.699 9.699l4.193 4.193M19.995 3.652L8.677 14.342"/>';
          }
        }
        mojs.addShape('check', Check);
        window.customShapeCheckAdded = true; // Set the flag
      }

      // Handle button click event
      function handleButtonClick(e) {
        var button = e.currentTarget;
        var rowContainer = button.closest('.nsfw-row');
        
        const circle = new mojs.Shape({
          parent: button,
          left: '50%', top: '50%',
          stroke: '#ffffff',
          strokeWidth: { [2 * window.RADIUS]: 0 },
          fill: 'none',
          scale: { 0: 1, easing: 'quad.out' },
          radius: window.RADIUS,
          duration: 450
        });

        const burst = new mojs.Burst({
          parent: button,
          left: '50%', top: '50%',
          radius: { 6: window.RADIUS - 7 },
          angle: 45,
          children: {
            shape: 'line',
            radius: window.RADIUS / 7.3,
            scale: 1,
            stroke: '#ffffff',
            strokeDasharray: '100%',
            strokeDashoffset: { '-100%': '100%' },
            degreeShift: 'stagger(0,-5)',
            duration: 700,
            delay: 200,
            easing: 'quad.out',
          }
        });

        const check = new mojs.Shape({
          parent: button.querySelector('.checkmark'),
          left: 52, top: 50,
          shape: 'check',
          stroke: '#ffffff',
          origin: '20% 10%',
          scale: { 0: 1 },
          easing: 'elastic.out',
          duration: 1600,
          delay: 300
        });

        const timeline = new mojs.Timeline({ speed: 1.5 }).add(burst, circle, check);
        const nsfwBtnText = button.querySelector('.nsfw-btn-text');
        if (nsfwBtnText) nsfwBtnText.remove();
        timeline.replay();

        setTimeout(() => {
          button.classList.add('shrink');
          setTimeout(() => {
            button.remove();
            setTimeout(() => {
              rowContainer.classList.add('hover-height');
            }, 0);
          }, 300);
        }, 400);
      }

      // Detach existing event listeners and re-attach them
      document.querySelectorAll('.nsfw-btn-container').forEach(function(button) {
        button.removeEventListener('click', handleButtonClick);
        button.addEventListener('click', handleButtonClick);
      });

    })();
`;

	const scriptElement = document.createElement('script');
	scriptElement.textContent = code;
	(document.head || document.documentElement).appendChild(scriptElement);
	scriptElement.remove();
}

function encodeToBase64(str) {
	const encoder = new TextEncoder();
	const data = encoder.encode(str);
	return btoa(String.fromCharCode(...data));
}

function reloadState() {
	console.log("Reloading state...")
	const currentImages = document.querySelectorAll('img, div[style*="background-image"]');
	currentImages.forEach(img => {
		const imageUrl = getImageUrl(img);
		if (srcToDOMObject.has(imageUrl)) {
			const predictions = srcToPredictions.get(imageUrl);
			const blurId = srcToDOMObject.get(imageUrl).getAttribute('data-blur-id');

			// Reapply blurId and update blur state
			img.setAttribute('data-blur-id', blurId);
			if (predictions && !isImageNSFW(predictions)) {
				img.classList.remove('nsfw-blur');
				img.classList.add('sfw-shown');
			} else {
				nsfwDetections++;
			}
		}
		else{
			// const imgRect = img.getBoundingClientRect();
			// if ((!imgRect.width < 64 || !imgRect.height < 64)) {
			// 	addImageToQueue(img, imgRect);
			// }
		}
	});

}

function getImageUrl(img) {
	if (img.tagName === 'IMG') {
		return img.src;
	} else {
	// Only works for background images with 1 URL. More than 1 is handled in more important areas ig.
		return img.style.backgroundImage.slice(4, -1).replace(/["']/g, "");
	}
}
