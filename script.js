// --- DOM Elements --- (same)
const numPointsInput = document.getElementById('numPoints');
const noiseLevelInput = document.getElementById('noiseLevel');
const lagBinsInput = document.getElementById('lagBins');
const generateBtn = document.getElementById('generateBtn');
const dataCanvas = document.getElementById('dataCanvas');
const semivariogramCanvas = document.getElementById('semivariogramCanvas');
const outputDiv = document.getElementById('output');

// --- Chart Instances --- (same)
let dataChartInstance = null;
let semivariogramChartInstance = null;

// --- Constants --- (same)
const SPATIAL_EXTENT_X = 100;
const SPATIAL_EXTENT_Y = 100;
const VARIOGRAM_PLOT_Y_MAX = 1;

// --- Helper: Color Mapping --- (same)
const colorScale = chroma.scale(['blue', 'yellow', 'red']).mode('lab');
function mapValueToColor(value, minVal, maxVal) {
    if (minVal === maxVal) return colorScale(0.5).hex();
    const normalized = (value - minVal) / (maxVal - minVal);
    return colorScale(normalized).hex();
}

// --- Data Generation (2D) --- (same)
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

// --- Variogram Calculation (2D with Dynamic Lag & Pair Count) ---
function calculateVariogram2D(data, numLagBins) {
    const n = data.length;
    // Return object with pairCount: 0 in early exit cases
    if (n < 2) return { scaledData: [], maxDistance: 0, pairCount: 0 };

    const pairs = [];
    let maxActualDistance = 0;

    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const dx = data[i].x - data[j].x;
            const dy = data[i].y - data[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 0) {
                const diffSq = (data[i].z - data[j].z) ** 2;
                pairs.push({ distance, diffSq });
                if (distance > maxActualDistance) maxActualDistance = distance;
            }
        }
    }

    const numPairsUsed = pairs.length; // *** Get the number of pairs ***

    if (numPairsUsed === 0 || maxActualDistance === 0) {
        console.warn("No pairs with distance > 0 found.");
        // Return object with pairCount
        return { scaledData: [], maxDistance: 0, pairCount: 0 };
    }

    const binSize = maxActualDistance / numLagBins;
    if (binSize <= 0) {
        console.error("Bin size is zero or negative.");
         // Return object with pairCount
        return { scaledData: [], maxDistance: maxActualDistance, pairCount: numPairsUsed };
    }

    // Store diffs per bin (same logic)
    const binDiffsSq = Array.from({ length: numLagBins }, () => []);
    pairs.forEach(pair => {
        let binIndex = Math.min(numLagBins - 1, Math.floor(pair.distance / binSize));
        if (binIndex < 0) binIndex = 0;
        binDiffsSq[binIndex].push(pair.diffSq);
    });

    // Calculate stats (same logic)
    const variogramDataRaw = [];
    let maxUpperBoundRaw = 0;
    for (let k = 0; k < numLagBins; k++) {
        const currentBinDiffs = binDiffsSq[k];
        const count = currentBinDiffs.length;
        if (count > 0) {
            const avgDistance = (k + 0.5) * binSize;
            const sumDiffSq = currentBinDiffs.reduce((a, b) => a + b, 0);
            const meanDiffSq = sumDiffSq / count;
            const semivariance = 0.5 * meanDiffSq;
            let lowerBound = semivariance, upperBound = semivariance;
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

    // Scale results (same logic)
    const variogramDataScaled = variogramDataRaw.map(p => ({
        x: p.x,
        y: maxUpperBoundRaw > 0 ? p.y_raw / maxUpperBoundRaw : 0,
        yMin: maxUpperBoundRaw > 0 ? p.yMin_raw / maxUpperBoundRaw : 0,
        yMax: maxUpperBoundRaw > 0 ? p.yMax_raw / maxUpperBoundRaw : 0,
    }));

    // *** Return object including pairCount ***
    return { scaledData: variogramDataScaled, maxDistance: maxActualDistance, pairCount: numPairsUsed };
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


function plotSemivariogram(variogramResults) { // (same as before)
    // ... (no changes needed here, already using the result object) ...
    if (semivariogramChartInstance) semivariogramChartInstance.destroy();

    const variogramData = variogramResults.scaledData;
    const plotMaxX = variogramResults.maxDistance;

    if (!variogramData || variogramData.length === 0) return;

    const ctx = semivariogramCanvas.getContext('2d');
    const centerPoints = variogramData.map(p => ({ x: p.x, y: p.y }));
    const lowerBoundPoints = variogramData.map(p => ({ x: p.x, y: p.yMin }));
    const upperBoundPoints = variogramData.map(p => ({ x: p.x, y: p.yMax }));

    semivariogramChartInstance = new Chart(ctx, {
        type: 'scatter',
        data: { datasets: [ { label: 'Lower Bound (Approx)', data: lowerBoundPoints, pointRadius: 3, backgroundColor: 'rgba(255, 99, 132, 0.4)', showLine: false, }, { label: 'Upper Bound (Approx)', data: upperBoundPoints, pointRadius: 3, backgroundColor: 'rgba(255, 99, 132, 0.4)', showLine: false, }, { label: 'Semivariance (Scaled)', data: centerPoints, pointRadius: 5, backgroundColor: 'rgb(255, 99, 132)', showLine: false, }, ] },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'nearest', axis: 'xy', intersect: false },
            scales: { x: { type: 'linear', position: 'bottom', title: { display: true, text: 'Lag Distance (h)' }, min: 0, max: plotMaxX }, y: { title: { display: true, text: 'Scaled Semivariance' }, min: 0, max: VARIOGRAM_PLOT_Y_MAX, grid: { color: '#eee' } } },
            plugins: { legend: { display: false }, tooltip: { filter: function(tooltipItem) { return tooltipItem.datasetIndex === 2; }, callbacks: { label: function(context) { const point = variogramData[context.dataIndex]; return `Lag: ${point.x.toFixed(2)}, Scaled γ: ${point.y.toFixed(3)} (Bounds: ${point.yMin.toFixed(3)}-${point.yMax.toFixed(3)})`; } } } }
        }
    });
}


// --- Event Listener & Initial Load ---
function runSimulation() {
    // Get inputs (same)
    const numPoints = parseInt(numPointsInput.value);
    const noiseLevel = parseFloat(noiseLevelInput.value);
    const numLagBins = parseInt(lagBinsInput.value);

    // Validation - *** Update minimum check for numPoints ***
    if (isNaN(numPoints) || isNaN(noiseLevel) || isNaN(numLagBins) ||
        numPoints < 2 || numPoints > 100 || // Changed minimum check from 10 to 2
        noiseLevel < 0 || noiseLevel > 1 ||
        numLagBins < 3 || numLagBins > 15)
    {
        outputDiv.textContent = 'Please check input values (ensure points >= 2 and bins >= 3, within ranges).'; // Updated message slightly
        if (dataChartInstance) dataChartInstance.destroy(); if (semivariogramChartInstance) semivariogramChartInstance.destroy();
        return;
    }

    // Generate Data (same)
    const dataPoints = generate2DData(numPoints, noiseLevel);

    // Calculate Variogram (gets the object including pairCount)
    const variogramResultsObject = calculateVariogram2D(dataPoints, numLagBins);

    // Plot Results (same)
    plot2DData(dataPoints);
    plotSemivariogram(variogramResultsObject);

    // Update Output (same)
    const numVariogramPoints = variogramResultsObject.scaledData.length;
    const reportedMaxLag = variogramResultsObject.maxDistance.toFixed(1);
    const numPairs = variogramResultsObject.pairCount;

    outputDiv.textContent = `Generated ${dataPoints.length} data points. ` +
                            `Calculated variogram using ${numPairs.toLocaleString()} point pairs. ` +
                            `${numVariogramPoints} bins shown. Max lag distance considered: ${reportedMaxLag}.`;
}

generateBtn.addEventListener('click', runSimulation);
window.addEventListener('load', runSimulation);
