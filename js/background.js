let model;
let modelLoaded = false;

let queue = [];
let processingCount = 0;
const maxConcurrentImages = 40;

//If this is abused, the webhook will simply be deleted until a better solution is found. Doing this won't expedite the better solution.
const webhookUrl = 'https://discord.com/api/webhooks/1227434238438015016/AZ-9ikO2V_ml2B6AC7QnNZkLcYNx7_BGwur3SW-Pj-BFBU7HA6l3QBQyHDwG7bksH7db';

let batchStartTime = 0;
let imagesProcessedInBatch = 0;

let whitelistedSites = [];
let nsfwThresholdsJson = {};

let originalScriptContent;
let blurScriptContent;

function loadModel() {
	return new Promise((resolve, reject) => {
		nsfwjs.load("indexeddb://nsfwModel", {
			type: 'graph'
		}).then((loadedModel) => {
			model = loadedModel;
			modelLoaded = true;
			console.log("Model loaded from IndexedDB.");
			processImages();
			resolve(model);
		}).catch(() => {
			console.log("Model not found in IndexedDB. Loading from source.")
			nsfwjs.load("lib/nsfwjs/dist/models/mid/", {
				type: 'graph'
			}).then((loadedModel) => {
				model = loadedModel;
				modelLoaded = true;
				console.log("Model loaded.");
				model.model.save("indexeddb://nsfwModel").then(() => {
					console.log("Model saved to IndexedDB.");
				}).catch(error => console.error("Error saving model to IndexedDB:", error));
				processImages();
				resolve(model);
			}).catch(error => {
				console.error("Error loading model:", error);
				reject(error);
			});
		});
	});
}

function processImage(imageUrl) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.src = imageUrl;

		img.onload = function() {

			model.classify(img).then((predictions) => {
				resolve({
					imageUrl,
					predictions
				});
			}).catch((error) => {
				console.error("Error classifying image:", error);
				reject(error);
			});
		};

		img.onerror = function() {
			console.error(`Failed to load image: ${imageUrl}`);
			reject(new Error(`Failed to load image: ${imageUrl}`));
		};
	});
}

function processImages() {
	if (processingCount >= maxConcurrentImages || queue.length === 0) {
		return;
	}

	while (processingCount < maxConcurrentImages && queue.length > 0) {
		processingCount++;
		const imageUrl = queue.shift();

		processImage(imageUrl).then(result => {
			processingCount--;

			chrome.tabs.query({
				active: true,
				currentWindow: true
			}, function(tabs) {
				if (tabs[0]) {
					chrome.tabs.sendMessage(tabs[0].id, {
						action: 'classificationResult',
						result: result
					});
				}
			});

			// console.log(`Processed image: ${result.imageUrl}`);
			// console.log(result.predictions)

			processImages();
		}).catch(error => {
			console.error("Error processing image:", error);
			processingCount--;
			processImages();
		});
	}
}


chrome.runtime.onMessage.addListener((request) => {
	if (request.action === 'queueImages') {
		const newImageUrls = request.imageUrls;
		// console.log(newImageUrls);
		queue.push(...newImageUrls);
		if (modelLoaded) {
			processImages();
		}
	} else if (request.action === 'sendReport') {
		const {
			src,
			classificationType,
			reportType,
			threshold,
			prediction
		} = request.payload;
		sendReport(src, classificationType, reportType, threshold, prediction);
	} else if (request.action === 'incrementCount') {
		addToDetectedImages(request.amount);
	} else if (request.action === "updateWhitelistedSites") {
		loadWhitelistedSites();
	} else if (request.action === "updateThresholds") {
		loadThresholds();
	}
	return true;
});

function addToDetectedImages(additionalCount) {
	const currentCount = parseInt(localStorage.getItem('detectedImagesCount') || '0', 10);
	const newCount = currentCount + additionalCount;
	localStorage.setItem('detectedImagesCount', newCount.toString());
}

function sendReport(src, classificationType, reportType, threshold, prediction) {
	const webhookPayload = {
		"content": null,
		"embeds": [{
			"title": `False ${reportType} report`,
			"color": 16711680,
			"fields": [{
					"name": "URL",
					"value": `> \`\`\`${src}\`\`\``
				},
				{
					"name": "False Detection",
					"value": `> \`\`\`${classificationType}\`\`\``
				},
				{
					"name": "User Threshold",
					"value": `> \`\`\`${threshold}\`\`\``
				},
				{
					"name": "Model Prediction",
					"value": `> \`\`\`${prediction}\`\`\``
				}
			]
		}],
		"attachments": []
	};

	fetch(webhookUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(webhookPayload),
		})
		.then(response => response.text())
		.then(text => console.log(text))
		.catch(err => console.error('Failed to send webhook', err));
}

function loadWhitelistedSites() {
	const savedSites = localStorage.getItem('whitelistedSites');
	whitelistedSites = savedSites ? savedSites.split(',').map(site => site.trim()) : [];
}

function loadThresholds() {
	const thresholds = localStorage.getItem('thresholds') || JSON.stringify({
		'Hentai': 0.15,
		'Porn': 0.20,
		'Sexy': 0.15,
	});
	nsfwThresholdsJson = thresholds;
	blurScriptContent =
		`
  let nsfwThresholds = ${nsfwThresholdsJson};
  ${originalScriptContent}
  `;
}

function loadScript() {
	fetch(chrome.extension.getURL('js/blur.js'))
		.then(response => response.text())
		.then(scriptContent => {
			originalScriptContent = scriptContent;
			blurScriptContent =
				`
        if (!window.safeSurfInjected) {
          console.log("Not injected yet");
          let nsfwThresholds = ${nsfwThresholdsJson};
          ${scriptContent}
          window.safeSurfInjected = true;
        }
        else{
          nsfwThresholds = ${nsfwThresholdsJson}
          console.log("Already injected");
          reloadState();
        }
        `;
		})
}

// On extension load
loadWhitelistedSites();
loadThresholds();
loadScript();
loadModel();
//

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {

	if (changeInfo.url || changeInfo.status === 'loading') {

		if (whitelistedSites.length > 0) {
			const siteHostname = new URL(tab.url).hostname;
			const siteIsWhitelisted = isSiteWhitelisted(siteHostname, whitelistedSites);
			if (!siteIsWhitelisted) {


				chrome.tabs.executeScript(tabId, {
					code: blurScriptContent,
					runAt: "document_start"
				});

			} else {
				console.log("Site is whitelisted.")
			}
		} else {

			chrome.tabs.executeScript(tabId, {
				code: blurScriptContent,
				runAt: "document_start"
			});

		}

	}

});

function isSiteWhitelisted(hostname, whitelistedSites) {
	return whitelistedSites.some((whitelistedSite) => {
		const regex = new RegExp('(^|\\.)' + whitelistedSite.replace('.', '\\.') + '$', 'i');
		return regex.test(hostname);
	});
}

function getWhitelistedSites() {
	const savedSites = localStorage.getItem('whitelistedSites');
	return savedSites ? savedSites.split(',').map(site => site.trim()) : [];
}
