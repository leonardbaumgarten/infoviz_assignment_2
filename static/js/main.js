/**
 * main.js – Application entry point & coordination
 *
 * Populates the indicator and year dropdowns, initialises all three
 * visualisation modules, and coordinates interactions between them.
 *
 * Global variables provided by Jinja2 / index.html:
 *   allData      – full filtered dataset (array of row objects)
 *   pcaData      – PCA 2-D coordinates per country for pcaYear
 *   explainedVar – [pc1_variance, pc2_variance]
 *   pcaYear      – year used for PCA (most recent = 2020)
 *   indicators   – list of numeric column names
 *   countries    – list of country names
 */

'use strict';

/* ── Application state ────────────────────────────────────────────────────── */
let currentCountry   = null;
let currentIndicator = indicators[0];
let currentYear      = pcaYear;

/* ── Populate the year dropdown ───────────────────────────────────────────── */
function populateYearDropdown() {
    const years = [...new Set(allData.map(d => d.Year))].sort((a, b) => b - a);
    const sel   = d3.select('#year-select');

    sel.selectAll('option')
        .data(years)
        .enter().append('option')
        .attr('value', d => d)
        .property('selected', d => d === pcaYear)
        .text(d => d);

    sel.on('change', function () {
        currentYear = +this.value;
        updateMap(currentIndicator, currentYear);
        if (currentCountry) updateLineChart(currentCountry, currentIndicator);
    });
}

/* ── Populate the indicator dropdown ─────────────────────────────────────── */
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
        if (currentCountry) updateLineChart(currentCountry, currentIndicator);
    });
}

/* ── Called by map.js and scatter.js when a country is clicked ───────────── */
function onCountrySelected(name) {
    currentCountry = name;

    // Update the info pill in the controls bar
    d3.select('#selected-info').html(
        `Selected: <span class="selected-country">${name}</span>`
    );

    // Highlight the country in both views
    highlightCountry(name);
    highlightScatterCountry(name);

    // Update the line chart
    updateLineChart(name, currentIndicator);
}

/* ── Initialise everything ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {

    populateIndicatorDropdown();
    populateYearDropdown();

    // Init visualisations
    initMap();       // map.js
    initScatter();   // scatter.js
    initLineChart(); // linechart.js

    // Wait a tiny tick for the map to load its topojson, then apply colours
    // The map itself calls updateMap after topojson loads (triggered below)
    // We hook in after the initial promise resolves by giving the map a callback
    // window.onMapReady is called from map.js once topojson is loaded.
    window.onMapReady = function () {
        updateMap(currentIndicator, currentYear);
    };
});
