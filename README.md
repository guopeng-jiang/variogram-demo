# Interactive 2D Variogram Demo

This repository hosts a simple, interactive web application demonstrating the concept of the empirical semivariogram for 2D spatial data. It's designed as an educational tool to visualize how spatial correlation affects variance over distance.

The application generates random 2D spatial data and calculates its corresponding semivariogram, displaying both the data distribution and the variogram plot.

## Live Demo

You can access the live demo hosted on GitHub Pages here:

**[https://guopeng-jiang.github.io/variogram-demo/](https://guopeng-jiang.github.io/variogram-demo/)**

## Features

*   **2D Data Generation:** Generates random points within a 100x100 spatial extent.
    *   Adjustable number of points (up to 100).
    *   Adjustable noise level to control the randomness vs. spatial trend in point values.
*   **Spatial Data Visualization:** Displays the generated points (X, Y coordinates) on a scatter plot.
    *   Points are colored based on their generated value (Z), using a blue-yellow-red color scale.
*   **Empirical Semivariogram Calculation & Plotting:**
    *   Calculates pairwise Euclidean distances and squared differences between point values.
    *   Bins pairs based on lag distance.
    *   Calculates the average semivariance (`γ(h) = 0.5 * Avg[(Z(i) - Z(j))^2]`) for each bin.
    *   Displays the results on a scatter plot (Semivariance vs. Lag Distance).
    *   **Variance Bounds:** Shows approximate +/- 1 standard deviation bounds for the semivariance estimate within each bin (visualized as lighter, smaller points). *Note: This is based on the variance of squared differences within the bin.*
    *   **Scaled Y-Axis:** The semivariance (Y-axis) is scaled to the range [0, 1] based on the maximum observed upper bound for better visualization across different datasets.
    *   **Dynamic X-Axis:** The lag distance (X-axis) automatically adjusts based on the maximum distance found in the data and the selected number of bins.
    *   Adjustable number of lag bins (up to 15).
*   **Interactivity:** Hover over points on the variogram plot to see detailed tooltip information (lag distance, scaled semivariance, scaled bounds).
*   **Responsive:** Basic responsive layout adapts to different screen sizes.

## How It Works (Conceptual Steps)

1.  **Generate Data:** Creates `N` points with random (X, Y) coordinates. Assigns a value (Z) to each point based on a subtle spatial trend combined with user-controlled random noise.
2.  **Calculate Pairs:** Computes the Euclidean distance and the squared difference in Z values for all unique pairs of points.
3.  **Determine Max Lag & Bin Size:** Finds the maximum distance among all pairs and divides it by the desired number of bins to get the lag interval (bin size).
4.  **Bin Pairs:** Assigns each pair to a lag bin based on its distance.
5.  **Calculate Bin Statistics:** For each bin containing pairs:
    *   Calculates the average lag distance (bin center).
    *   Calculates the mean squared difference of Z values.
    *   Calculates the semivariance (0.5 * mean squared difference).
    *   Calculates the standard deviation of the squared differences within the bin to estimate variance bounds.
6.  **Scale Results:** Normalizes the calculated semivariances and bounds to the range [0, 1] based on the maximum upper bound observed.
7.  **Plot:** Uses Chart.js to render the two scatter plots:
    *   Data Plot: (X, Y) colored by Z.
    *   Variogram Plot: (Average Lag, Scaled Semivariance) with points for scaled bounds.

## Technologies Used

*   HTML5
*   CSS3
*   JavaScript (ES6+)
*   [Chart.js](https://www.chartjs.org/) - For creating interactive plots.
*   [Chroma.js](https://gka.github.io/chroma.js/) - For easy color scaling.
*   [GitHub Pages](https://pages.github.com/) - For hosting the live demo.

## How to Run Locally

1.  Clone this repository:
    ```bash
    git clone https://github.com/guopeng-jiang/variogram-demo.git
    ```
2.  Navigate to the cloned directory:
    ```bash
    cd variogram-demo
    ```
3.  Open the `index.html` file in your web browser. No web server is required.

## License

This project is intended for educational purposes.