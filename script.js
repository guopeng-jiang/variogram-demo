// Get references to DOM elements (same as before)
const numPointsInput = document.getElementById('numPoints');
const noiseLevelInput = document.getElementById('noiseLevel');
const lagBinsInput = document.getElementById('lagBins');
const maxLagDistanceInput = document.getElementById('maxLagDistance');
const generateBtn = document.getElementById('generateBtn');
const variogramCanvas = document.getElementById('variogramChart');
const outputDiv = document.getElementById('output');

let variogramChartInstance = null;

// Function to generate sample data (same as before)
function generateData(numPoints, noiseLevel) {
    const data = [];
    let currentValue = 0;
    for (let i = 0; i < numPoints; i++) {
        const structuredChange = (Math.random() - 0.5) * (1 - noiseLevel) * 10;
        const randomNoise = (Math.random() - 0.5) * noiseLevel * 20;
        currentValue += structuredChange + randomNoise;
        data.push({ x: i, z: currentValue });
    }
    return data;
}

// Function to calculate the empirical semivariogram with scaling
function calculateVariogram(data, numLagBins, maxLagDistance) {
    const n = data.length;
    if (n < 2) return { lags: [], variances: [], pointData: [] };

    // Calculate pairwise distances and squared differences, respecting the limit
    const pairs = [];
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const dx = Math.abs(data[i].x - data[j].x);
            if (dx <= maxLagDistance) {
                const dzSq = (data[i].z - data[j].z) ** 2;
                pairs.push({ distance: dx, diffSq: dzSq });
            }
        }
    }

    if (pairs.length === 0) {
        console.warn("No pairs found within the specified max lag distance.");
        return { lags: [], variances: [], pointData: [] };
    }

    const binSize = maxLagDistance / numLagBins;
    if (binSize <= 0) {
        console.error("Bin size is zero or negative.");
        return { lags: [], variances: [], pointData: [] };
    }

    const binSums = new Array(numLagBins).fill(0);
    const binCounts = new Array(numLagBins).fill(0);

    pairs.forEach(pair => {
        let binIndex = Math.floor(pair.distance / binSize);
        if (binIndex >= numLagBins) binIndex = numLagBins - 1;
        if (binIndex < 0) binIndex = 0;
        binSums[binIndex] += pair.diffSq;
        binCounts[binIndex] += 1;
    });

    // Calculate raw semivariance and store intermediate data
    const intermediateData = [];
    let maxVariance = 0; // Find the max raw semivariance for scaling
    for (let k = 0; k < numLagBins; k++) {
        const avgDistance = (k + 0.5) * binSize;
        if (binCounts[k] > 0) {
            const semivariance = (binSums[k] / binCounts[k]) * 0.5;
            intermediateData.push({ x: avgDistance, y_raw: semivariance }); // Store raw value temporarily
            if (semivariance > maxVariance) {
                maxVariance = semivariance;
            }
        }
    }

    // *** Scale the semivariance values to [0, 1] ***
    const pointData = intermediateData.map(point => ({
        x: point.x,
        // Scale y value. Handle division by zero if maxVariance is 0.
        y: (maxVariance > 0) ? point.y_raw / maxVariance : 0
    }));

    // Extract lags and scaled variances (optional, pointData is primary now)
    const lags = pointData.map(p => p.x.toFixed(2));
    const variances = pointData.map(p => p.y);

    // Return scaled data
    return { lags, variances, pointData };
}

// Function to plot the scaled variogram
function plotVariogram(pointData) { // No longer needs maxLagDistance for axis limits
    if (variogramChartInstance) {
        variogramChartInstance.destroy();
    }
    const ctx = variogramCanvas.getContext('2d');

    variogramChartInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Scaled Semivariance (γ(h) / max(γ))', // Update label
                data: pointData,
                backgroundColor: 'rgb(0, 123, 255)', // Changed color slightly
                pointRadius: 5,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: {
                        display: true,
                        text: 'Lag Distance (h)'
                    },
                    min: 0,
                    max: 100 // Keep the fixed X limit
                },
                y: {
                    title: {
                        display: true,
                        // *** Update Y-axis title ***
                        text: 'Scaled Semivariance'
                    },
                    min: 0,
                    // *** Set Y-axis max to 1 ***
                    max: 1
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function() { return ''; },
                        label: function(context) {
                             // Tooltip shows the scaled value
                            let label = context.dataset.label || '';
                             if (label) {
                                label = 'Scaled γ: '; // Simpler label
                            }
                            if (context.parsed.y !== null) {
                                label += `${context.parsed.y.toFixed(3)} (at lag ${context.parsed.x.toFixed(2)})`;
                            }
                             return label;
                        }
                    }
                }
            }
        }
    });
}

// Event listener for the generate button (no changes needed here, but update output text)
generateBtn.addEventListener('click', () => {
    const numPoints = parseInt(numPointsInput.value);
    const noiseLevel = parseFloat(noiseLevelInput.value);
    const numLagBins = parseInt(lagBinsInput.value);
    const maxLagDistance = parseFloat(maxLagDistanceInput.value);

    // Validation (same as before)
    if (isNaN(numPoints) || numPoints < 20 || numPoints > 500) {
        outputDiv.textContent = 'Please enter a valid number of points (20-500).'; return;
    }
    if (isNaN(noiseLevel) || noiseLevel < 0 || noiseLevel > 1) {
         outputDiv.textContent = 'Please enter a valid noise level (0-1).'; return;
    }
    if (isNaN(numLagBins) || numLagBins < 5 || numLagBins > 30) {
         outputDiv.textContent = 'Please enter a valid number of lag bins (5-30).'; return;
    }
    if (isNaN(maxLagDistance) || maxLagDistance <= 0 ) {
         outputDiv.textContent = 'Please enter a valid positive Max Lag Distance for calculation.'; return;
    }

    // Generate data
    const dataPoints = generateData(numPoints, noiseLevel);

    // Calculate scaled variogram
    const { lags, variances, pointData } = calculateVariogram(dataPoints, numLagBins, maxLagDistance);

    // Plot scaled variogram
    plotVariogram(pointData); // Pass only pointData

    // Display info (update text)
    const numPairsTotal = dataPoints.length * (dataPoints.length - 1) / 2;
    const numPointsUsed = pointData.length;
    outputDiv.textContent = `Generated ${dataPoints.length} points. Calculated ${numPairsTotal} total possible pairs. ` +
                            `Used pairs within calculation limit of ${maxLagDistance} distance. ` +
                            `Plotted ${numPointsUsed} variogram points. Y-values scaled to [0, 1]. Chart axes fixed (X max: 20, Y max: 1).`;
});

// Initial plot when the page loads
generateBtn.click();