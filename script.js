// --- DOM Elements ---
const numPointsInput = document.getElementById('numPoints');
const noiseLevelInput = document.getElementById('noiseLevel');
const lagBinsInput = document.getElementById('lagBins');
// const maxLagDistanceInput = document.getElementById('maxLagDistance'); // Removed
const generateBtn = document.getElementById('generateBtn');
const dataCanvas = document.getElementById('dataCanvas');
const semivariogramCanvas = document.getElementById('semivariogramCanvas');
const outputDiv = document.getElementById('output');

// --- Chart Instances ---
let dataChartInstance = null;
let semivariogramChartInstance = null;

// --- Constants ---
const SPATIAL_EXTENT_X = 100;
const SPATIAL_EXTENT_Y = 100;
// const VARIOGRAM_PLOT_X_MAX = 20; // Removed fixed limit
const VARIOGRAM_PLOT_Y_MAX = 1; // Keep fixed Y axis (scaled)

// --- Helper: Color Mapping (same as before) ---
const colorScale = chroma.scale(['blue', 'yellow', 'red']).mode('lab');
function mapValueToColor(value, minVal, maxVal) {
    if (minVal === maxVal) return colorScale(0.5).hex();
    const normalized = (value - minVal) / (maxVal - minVal);
    return colorScale(normalized).hex();
}

// --- Data Generation (2D) (same as before) ---
function generate2DData(numPoints, noiseLevel) {
    const data = [];
    const trendStrength = 100 * (1 - noiseLevel);
    const noiseStrength = 150 * noiseLevel;
    for (let i = 0; i < numPoints; i++) {
        const x = Math.random() * SPATIAL_EXTENT_X;
        const y = Math.random() * SPATIAL_EXTENT_Y;
        const trendValue = (x / SPATIAL_EXTENT_X + y / SPATIAL_EXTENT_Y) * trendStrength / 2;
        const noiseValue = (Math.random() - 0.5) * noiseStrength;
        const z = trendValue + noiseValue;
        data.push({ x, y, z });
    }
    return data;
}

// --- Variogram Calculation (2D with Dynamic Lag) ---
function calculateVariogram2D(data, numLagBins) { // Removed maxLagDistance parameter
    const n = data.length;
    if (n < 2) return { scaledData: [], maxDistance: 0 }; // Return object even if empty

    const pairs = [];
    let maxActualDistance = 0; // Track the maximum distance found

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const dx = data[i].x - data[j].x;
            const dy = data[i].y - data[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Process all pairs with distance > 0
            if (distance > 0) {
                const diffSq = (data[i].z - data[j].z) ** 2;
                pairs.push({ distance, diffSq });
                // Update max distance found
                if (distance > maxActualDistance) {
                    maxActualDistance = distance;
                }
            }
        }
    }

    if (pairs.length === 0 || maxActualDistance === 0) {
        console.warn("No pairs with distance > 0 found.");
        return { scaledData: [], maxDistance: 0 };
    }

    // Calculate binSize based on the actual max distance found
    const binSize = maxActualDistance / numLagBins;
    if (binSize <= 0) { // Should only happen if maxActualDistance is 0, already handled
        console.error("Bin size is zero or negative.");
        return { scaledData: [], maxDistance: maxActualDistance };
    }

    // Store all squared differences per bin (same as before)
    const binDiffsSq = Array.from({ length: numLagBins }, () => []);
    pairs.forEach(pair => {
        // Ensure binIndex does not exceed max index, even with floating point inaccuracies
        let binIndex = Math.min(numLagBins - 1, Math.floor(pair.distance / binSize));
         if (binIndex < 0) binIndex = 0; // Safety check
        binDiffsSq[binIndex].push(pair.diffSq);
    });

    // Calculate stats for each bin (same logic as before)
    const variogramDataRaw = [];
    let maxUpperBoundRaw = 0;
    for (let k = 0; k < numLagBins; k++) {
        const currentBinDiffs = binDiffsSq[k];
        const count = currentBinDiffs.length;
        if (count > 0) {
            const avgDistance = (k + 0.5) * binSize; // Center of the bin
            const sumDiffSq = currentBinDiffs.reduce((a, b) => a + b, 0);
            const meanDiffSq = sumDiffSq / count;
            const semivariance = 0.5 * meanDiffSq;

            let lowerBound = semivariance;
            let upperBound = semivariance;
            if (count > 1) {
                const varianceOfDiffSq = currentBinDiffs.reduce((sum, val) => sum + (val - meanDiffSq) ** 2, 0) / (count - 1);
                const stdDevOfDiffSq = Math.sqrt(varianceOfDiffSq);
                const semivarianceStdDev = 0.5 * stdDevOfDiffSq;
                lowerBound = Math.max(0, semivariance - semivarianceStdDev);
                upperBound = semivariance + semivarianceStdDev;
            }
            variogramDataRaw.push({ x: avgDistance, y_raw: semivariance, yMin_raw: lowerBound, yMax_raw: upperBound });
            if (upperBound > maxUpperBoundRaw) maxUpperBoundRaw = upperBound;
        }
    }

    // Scale the results (same as before)
    const variogramDataScaled = variogramDataRaw.map(p => ({
        x: p.x,
        y: maxUpperBoundRaw > 0 ? p.y_raw / maxUpperBoundRaw : 0,
        yMin: maxUpperBoundRaw > 0 ? p.yMin_raw / maxUpperBoundRaw : 0,
        yMax: maxUpperBoundRaw > 0 ? p.yMax_raw / maxUpperBoundRaw : 0,
    }));

    // Return both scaled data and the max distance used for binning
    return { scaledData: variogramDataScaled, maxDistance: maxActualDistance };
}


// --- Plotting Functions ---

function plot2DData(dataPoints) { // (same as before)
    if (dataChartInstance) {
        dataChartInstance.destroy();
    }
    if (!dataPoints || dataPoints.length === 0) return;
    const ctx = dataCanvas.getContext('2d');
    const values = dataPoints.map(p => p.z);
    const minZ = Math.min(...values);
    const maxZ = Math.max(...values);
    dataChartInstance = new Chart(ctx, {
        type: 'scatter',
        data: { datasets: [{
            label: 'Data Points',
            data: dataPoints.map(p => ({ x: p.x, y: p.y })),
            pointRadius: 5,
            pointBackgroundColor: dataPoints.map(p => mapValueToColor(p.z, minZ, maxZ)),
        }] },
        options: {
            responsive: true, maintainAspectRatio: false, aspectRatio: 1,
            scales: {
                x: { title: { display: true, text: 'X Coordinate' }, min: 0, max: SPATIAL_EXTENT_X, grid: { color: '#eee' } },
                y: { title: { display: true, text: 'Y Coordinate' }, min: 0, max: SPATIAL_EXTENT_Y, grid: { color: '#eee' } }
            },
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: function(context) {
                    const index = context.dataIndex; const point = dataPoints[index];
                    return `(X: ${point.x.toFixed(1)}, Y: ${point.y.toFixed(1)}), Value: ${point.z.toFixed(2)}`;
                }}}
            }
        }
    });
}

// Updated plotting function for semivariogram
function plotSemivariogram(variogramResults) {
    if (semivariogramChartInstance) {
        semivariogramChartInstance.destroy();
    }

    const variogramData = variogramResults.scaledData;
    const plotMaxX = variogramResults.maxDistance;

    if (!variogramData || variogramData.length === 0) return;

    const ctx = semivariogramCanvas.getContext('2d');

    const centerPoints = variogramData.map(p => ({ x: p.x, y: p.y }));
    const lowerBoundPoints = variogramData.map(p => ({ x: p.x, y: p.yMin }));
    const upperBoundPoints = variogramData.map(p => ({ x: p.x, y: p.yMax }));

    semivariogramChartInstance = new Chart(ctx, {
        type: 'scatter',
        data: { /* ... (datasets remain the same) ... */
           datasets: [
                {
                    label: 'Lower Bound (Approx)', data: lowerBoundPoints, pointRadius: 3,
                    backgroundColor: 'rgba(255, 99, 132, 0.4)', showLine: false,
                },
                {
                    label: 'Upper Bound (Approx)', data: upperBoundPoints, pointRadius: 3,
                    backgroundColor: 'rgba(255, 99, 132, 0.4)', showLine: false,
                },
                {
                    label: 'Semivariance (Scaled)', data: centerPoints, pointRadius: 5,
                    backgroundColor: 'rgb(255, 99, 132)', showLine: false,
                    // Optional: Increase hit radius slightly if intersect:false isn't enough
                    // pointHitRadius: 10
                },
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            // *** Add Interaction Settings ***
            interaction: {
                mode: 'nearest', // Find the single nearest item
                axis: 'xy',      // Check both x and y proximity
                intersect: false // IMPORTANT: Trigger tooltip even if mouse isn't directly over the point's pixels
            },
            scales: { /* ... (scales remain the same) ... */
                x: {
                    type: 'linear', position: 'bottom',
                    title: { display: true, text: 'Lag Distance (h)' },
                    min: 0,
                    max: plotMaxX
                },
                y: {
                    title: { display: true, text: 'Scaled Semivariance' },
                    min: 0,
                    max: VARIOGRAM_PLOT_Y_MAX,
                    grid: { color: '#eee' }
                }
            },
            plugins: { /* ... (plugins remain the same) ... */
                 legend: { display: false },
                 tooltip: {
                     // Tooltip inherits interaction mode unless overridden here
                     filter: function(tooltipItem) { return tooltipItem.datasetIndex === 2; },
                     callbacks: { label: function(context) {
                         const point = variogramData[context.dataIndex];
                         return `Lag: ${point.x.toFixed(2)}, Scaled γ: ${point.y.toFixed(3)} (Bounds: ${point.yMin.toFixed(3)}-${point.yMax.toFixed(3)})`;
                     }}
                 }
            }
        }
    });
}


// --- Event Listener & Initial Load ---
function runSimulation() {
    // Get inputs
    const numPoints = parseInt(numPointsInput.value);
    const noiseLevel = parseFloat(noiseLevelInput.value);
    const numLagBins = parseInt(lagBinsInput.value);
    // const maxLagDistance = parseFloat(maxLagDistanceInput.value); // Removed

    // Validation
    if (isNaN(numPoints) || isNaN(noiseLevel) || isNaN(numLagBins) ||
        numPoints < 10 || numPoints > 100 ||
        noiseLevel < 0 || noiseLevel > 1 ||
        numLagBins < 3 || numLagBins > 15)
    {
        outputDiv.textContent = 'Please check input values (ensure they are within specified ranges).';
        // Clear plots if input is invalid
        if (dataChartInstance) dataChartInstance.destroy();
        if (semivariogramChartInstance) semivariogramChartInstance.destroy();
        return;
    }

    // Generate Data
    const dataPoints = generate2DData(numPoints, noiseLevel);

    // Calculate Variogram (no maxLagDistance passed)
    const variogramResultsObject = calculateVariogram2D(dataPoints, numLagBins);

    // Plot Results (pass the whole object)
    plot2DData(dataPoints);
    plotSemivariogram(variogramResultsObject);

    // Update Output
    const numVariogramPoints = variogramResultsObject.scaledData.length;
    const reportedMaxLag = variogramResultsObject.maxDistance.toFixed(1);
    outputDiv.textContent = `Generated ${dataPoints.length} data points. ` +
                            `Calculated ${numVariogramPoints} variogram bins with data. ` +
                            `Max lag distance considered: ${reportedMaxLag}.`;
}

generateBtn.addEventListener('click', runSimulation);
window.addEventListener('load', runSimulation);