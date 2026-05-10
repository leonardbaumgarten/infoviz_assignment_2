'use strict';

/* Application state */
let currentCountry = null;
let currentIndicator = indicators[0];
let currentYear = pcaYear;
let currentBrushed = [];

/* Available years from dataset */
const availableYears = [...new Set(allData.map(d => d.Year))].sort((a, b) => a - b);
const yearMin = availableYears[0];
const yearMax = availableYears[availableYears.length - 1];

/* Year slider setup and event binding */
function initYearSlider() {
    const slider = document.getElementById('year-slider');
    const label = document.getElementById('year-slider-value');

    slider.min = yearMin;
    slider.max = yearMax;
    slider.value = pcaYear;
    slider.step = 1;
    label.textContent = pcaYear;

    slider.addEventListener('input', function () {
        const raw = +this.value;
        const snapped = availableYears.reduce((prev, curr) =>
            Math.abs(curr - raw) < Math.abs(prev - raw) ? curr : prev
        );
        currentYear = snapped;
        label.textContent = snapped;

        updateMap(currentIndicator, currentYear);
        updateScatterStyling(currentIndicator, currentYear);
        updateYearLine(currentYear);

        if (currentBrushed.length > 0) {
            updateLineChartMulti(currentBrushed, currentIndicator);
        } else if (currentCountry) {
            updateLineChart(currentCountry, currentIndicator);
        }
    });
}

/* Indicator dropdown setup */
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

        updateMap(currentIndicator, currentYear);
        updateScatterStyling(currentIndicator, currentYear);

        if (currentBrushed.length > 0) {
            updateLineChartMulti(currentBrushed, currentIndicator);
        } else if (currentCountry) {
            updateLineChart(currentCountry, currentIndicator);
        }
    });
}

/* Cross-view interaction: scatter hover highlights map country */
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

/* Cross-view interaction: map hover highlights scatterplot dot */
function onMapHover(name) {
    highlightScatterCountry(name);
}

function onMapHoverEnd() {
    if (brushedNames.size > 0) {
        applyBrushHighlight();
    } else {
        clearScatterHighlight();
    }
}

/* Map click triggers time-series line chart */
function onMapClick(name) {
    currentCountry = name;

    d3.select('#selected-info').html(
        `Selected: <span class="selected-country">${name}</span>`
    );

    highlightCountry(name);
    highlightScatterCountry(name);
    updateLineChart(name, currentIndicator);
    updateYearLine(currentYear);
}

/* Brush selection updates line chart with all selected countries */
function onBrushSelection(nameSet) {
    currentBrushed = [...nameSet];

    d3.select('#selected-info').html(
        `Brushed: <span class="selected-country">${currentBrushed.length} countries</span>`
    );

    updateLineChartMulti(currentBrushed, currentIndicator);
    updateYearLine(currentYear);
}

function onBrushCleared() {
    currentBrushed = [];
    currentCountry = null;
    clearLineChart();
    d3.select('#selected-info').html(
        '<span class="selected-label">Click a country to explore</span>'
    );
}

/* Bootstrap all visualisations on DOM ready */
document.addEventListener('DOMContentLoaded', function () {
    populateIndicatorDropdown();
    initYearSlider();
    initMap();
    initScatter();
    initLineChart();

    window.onMapReady = function () {
        updateMap(currentIndicator, currentYear);
        updateScatterStyling(currentIndicator, currentYear);
        updateYearLine(currentYear);
    };
});
