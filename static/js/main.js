/**
 * main.js – Application entry point & coordination (Tasks 5 & 6)
 *
 * Wires up the indicator dropdown, year SLIDER, and coordinates all
 * cross-view interactions (hover, click, brush, indicator change).
 *
 * Global variables (var) from index.html / Jinja2:
 *   allData, pcaData, explainedVar, pcaYear, indicators, countries
 */

'use strict';

/* ── Application state ────────────────────────────────────────────────────── */
let currentCountry   = null;   // last clicked country (single selection)
let currentIndicator = indicators[0];
let currentYear      = pcaYear;
let currentBrushed   = [];     // names from brush selection

/* ── Build the available years list once ──────────────────────────────────── */
const availableYears = [...new Set(allData.map(d => d.Year))].sort((a, b) => a - b);
const yearMin  = availableYears[0];
const yearMax  = availableYears[availableYears.length - 1];

/* ──────────────────────────────────────────────────────────────────────────
   Year SLIDER (Task 6 – replaces the dropdown)
   ────────────────────────────────────────────────────────────────────────── */
function initYearSlider() {
    const slider = document.getElementById('year-slider');
    const label  = document.getElementById('year-slider-value');

    slider.min   = yearMin;
    slider.max   = yearMax;
    slider.value = pcaYear;
    slider.step  = 1;
    label.textContent = pcaYear;

    slider.addEventListener('input', function () {
        // Snap to nearest available year
        const raw   = +this.value;
        const snapped = availableYears.reduce((prev, curr) =>
            Math.abs(curr - raw) < Math.abs(prev - raw) ? curr : prev
        );
        currentYear = snapped;
        label.textContent = snapped;

        // Update choropleth map
        updateMap(currentIndicator, currentYear);

        // Update time series if a country is selected or brushed
        if (currentBrushed.length > 0) {
            updateLineChartMulti(currentBrushed, currentIndicator);
        } else if (currentCountry) {
            updateLineChart(currentCountry, currentIndicator);
        }
    });
}

/* ──────────────────────────────────────────────────────────────────────────
   Indicator dropdown (Task 6 – also updates scatterplot styling)
   ────────────────────────────────────────────────────────────────────────── */
function populateIndicatorDropdown() {
    const sel = d3.select('#indicator-select');

    sel.selectAll('option')
        .data(indicators)
        .enter().append('option')
        .attr('value', d => d)
        .property('selected', d => d === indicators[0])
        .text(d => d);

    sel.on('change', function () {
        currentIndicator = this.value;

        // 1. Update choropleth map
        updateMap(currentIndicator, currentYear);

        // 2. Update scatterplot styling (Task 6 requirement)
        updateScatterStyling(currentIndicator, currentYear);

        // 3. Update time series
        if (currentBrushed.length > 0) {
            updateLineChartMulti(currentBrushed, currentIndicator);
        } else if (currentCountry) {
            updateLineChart(currentCountry, currentIndicator);
        }
    });
}

/* ──────────────────────────────────────────────────────────────────────────
   Cross-view interaction callbacks
   ────────────────────────────────────────────────────────────────────────── */

/* --- Scatter hover → map highlight (Task 5) ----------------------------- */
function onScatterHover(name) {
    highlightCountry(name);
}

function onScatterHoverEnd() {
    if (currentBrushed.length > 0) {
        highlightCountriesByNames(new Set(currentBrushed));
    } else {
        clearMapHighlight();
    }
}

/* --- Map hover → scatter highlight (Task 5) ----------------------------- */
function onMapHover(name) {
    highlightScatterCountry(name);
}

function onMapHoverEnd() {
    if (brushedNames.size > 0) {
        // Restore brush state in scatterplot
        applyBrushHighlight();
    } else {
        clearScatterHighlight();
    }
}

/* --- Map click → time-series line chart (Task 5) ------------------------ */
function onMapClick(name) {
    currentCountry = name;

    d3.select('#selected-info').html(
        `Selected: <span class="selected-country">${name}</span>`
    );

    // Highlight
    highlightCountry(name);
    highlightScatterCountry(name);

    // Show time series for this single country
    updateLineChart(name, currentIndicator);
}

/* --- Brush selection → highlight map + update line chart (Task 6) ------- */
function onBrushSelection(nameSet) {
    currentBrushed = [...nameSet];

    d3.select('#selected-info').html(
        `Brushed: <span class="selected-country">${currentBrushed.length} countries</span>`
    );

    // Update line chart with all brushed countries
    updateLineChartMulti(currentBrushed, currentIndicator);
}

function onBrushCleared() {
    currentBrushed = [];
    currentCountry = null;
    clearLineChart();
    d3.select('#selected-info').html(
        '<span class="selected-label">Click a country to explore</span>'
    );
}

/* ──────────────────────────────────────────────────────────────────────────
   Initialise everything
   ────────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {

    populateIndicatorDropdown();
    initYearSlider();

    // Init visualisations
    initMap();
    initScatter();
    initLineChart();

    // Once the map's topojson is loaded, render the initial choropleth colours
    // and apply the initial scatterplot indicator styling
    window.onMapReady = function () {
        updateMap(currentIndicator, currentYear);
        updateScatterStyling(currentIndicator, currentYear);
    };
});
