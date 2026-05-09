/**
 * map.js – Choropleth world map (Task 3)
 *
 * Draws a world map, colour-encodes countries by a selected indicator
 * and a selected year from the allData dataset.
 *
 * Exports:  initMap()  –  called from main.js
 * Calls:    onCountrySelected(name)  –  defined in main.js
 */

'use strict';

/* ── Module-level state ───────────────────────────────────────────────────── */
let mapSvg, mapG, mapPath, mapProjection;
let mapWidth, mapHeight;

/* Country path selection kept for highlight updates */
let countryPaths;

/* Current indicator & year (set by updateMap, called from main.js) */
let map_currentIndicator = null;
let map_currentYear = null;
let map_selectedCountry = null;

/* ── Colour scale ─────────────────────────────────────────────────────────── */
let map_colorScale = null;

/* ── Helper: build lookup of value per country ISO3 code ─────────────────── */
function buildValueLookup(indicator, year) {
    const lookup = {};
    allData.forEach(d => {
        if (d.Year === year) {
            const v = d[indicator];
            lookup[d.Code] = (v !== null && v !== undefined && !isNaN(v)) ? +v : null;
        }
    });
    return lookup;
}

/* ── Colour scale builder ─────────────────────────────────────────────────── */
function buildColorScale(lookup) {
    const values = Object.values(lookup).filter(v => v !== null);
    if (values.length === 0) return () => '#2a2d3e';

    const [lo, hi] = d3.extent(values);
    return d3.scaleSequential()
        .domain([lo, hi])
        .interpolator(d3.interpolateYlOrRd);
}

/* ── Colour legend ────────────────────────────────────────────────────────── */
function drawLegend(lookup) {
    const container = d3.select('#map-legend');
    container.selectAll('*').remove();

    const values = Object.values(lookup).filter(v => v !== null);
    if (values.length === 0) return;

    const [lo, hi] = d3.extent(values);
    const legendW = 220, legendH = 10;

    const svg = container.append('svg')
        .attr('width', legendW + 80)
        .attr('height', 30);

    // Gradient definition
    const defs = svg.append('defs');
    const gradId = 'map-legend-grad';
    const grad = defs.append('linearGradient').attr('id', gradId);
    grad.selectAll('stop')
        .data(d3.range(0, 1.01, 0.1))
        .enter().append('stop')
        .attr('offset', d => `${d * 100}%`)
        .attr('stop-color', d => d3.interpolateYlOrRd(d));

    svg.append('rect')
        .attr('x', 0).attr('y', 6)
        .attr('width', legendW).attr('height', legendH)
        .attr('rx', 3)
        .style('fill', `url(#${gradId})`);

    const fmt = d3.format(hi > 1e6 ? '.2s' : hi > 100 ? ',.0f' : '.2f');
    svg.append('text').attr('x', 0).attr('y', 24)
        .attr('class', 'axis-label').text(fmt(lo));
    svg.append('text').attr('x', legendW).attr('y', 24)
        .attr('class', 'axis-label').attr('text-anchor', 'end').text(fmt(hi));
}

/* ── Tooltip ─────────────────────────────────────────────────────────────── */
const mapTip = d3.select('#map-tooltip');

function showMapTip(event, d, lookup) {
    const code = d.properties ? d.properties.id : null;
    const name = codeToName[code] || d.properties?.name || code || '—';
    const val = lookup[code];
    const fmt = (val === null || val === undefined)
        ? '<em style="color:#4a5568">No data</em>'
        : `<span>${d3.format(Math.abs(val) > 1e6 ? '.3s' : Math.abs(val) > 100 ? ',.0f' : '.3f')(val)}</span>`;

    mapTip.html(`<div class="tt-country">${name}</div><div class="tt-value">${currentIndicator || ''}: ${fmt}</div>`)
        .classed('visible', true);
    moveMapTip(event);
}

function moveMapTip(event) {
    const [mx, my] = d3.pointer(event, document.body);
    mapTip.style('left', `${mx + 14}px`).style('top', `${my - 10}px`);
}

function hideMapTip() { mapTip.classed('visible', false); }

/* ── Build ISO3→name lookup from allData ─────────────────────────────────── */
const codeToName = {};
allData.forEach(d => { codeToName[d.Code] = d.Name; });

/* ── Map update (called when indicator or year changes) ─────────────────── */
function updateMap(indicator, year) {
    map_currentIndicator = indicator;
    map_currentYear = year;

    const lookup = buildValueLookup(indicator, year);
    map_colorScale = buildColorScale(lookup);

    // Update country fill colours
    countryPaths
        .classed('no-data', d => lookup[(d.properties?.id)] === null || lookup[(d.properties?.id)] === undefined)
        .attr('fill', d => {
            const v = lookup[d.properties?.id];
            return (v === null || v === undefined) ? '#2a2d3e' : map_colorScale(v);
        });

    // Update map subtitle
    d3.select('#map-subtitle').text(`${indicator} · ${year}`);

    drawLegend(lookup);
}

/* ── Highlight a selected country ────────────────────────────────────────── */
function highlightCountry(name) {
    map_selectedCountry = name;
    countryPaths
        .classed('selected', d => codeToName[d.properties?.id] === name);
}

/* ── initMap ─────────────────────────────────────────────────────────────── */
function initMap() {
    const container = document.getElementById('map-section');
    const svgEl = document.getElementById('svg_map');

    mapWidth = svgEl.clientWidth || 820;
    mapHeight = svgEl.clientHeight || 460;

    mapSvg = d3.select('#svg_map')
        .attr('width', mapWidth)
        .attr('height', mapHeight);

    mapProjection = d3.geoEqualEarth()
        .scale(mapWidth / 5.8)
        .translate([mapWidth / 2, mapHeight / 1.85]);

    mapPath = d3.geoPath().projection(mapProjection);

    d3.json('/static/data/world-topo.json').then(function (world) {

        const features = topojson.feature(world, world.objects.countries).features;

        mapG = mapSvg.append('g');

        countryPaths = mapG.selectAll('path')
            .data(features)
            .enter().append('path')
            .attr('class', 'country-path no-data')
            .attr('d', mapPath)
            .attr('fill', '#2a2d3e')
            .on('mouseover', function (event, d) {
                showMapTip(event, d, buildValueLookup(map_currentIndicator, map_currentYear) || {});
            })
            .on('mousemove', moveMapTip)
            .on('mouseout', hideMapTip)
            .on('click', function (event, d) {
                const code = d.properties?.id;
                const name = codeToName[code];
                if (name) onCountrySelected(name);
            });

        // Trigger initial colour render via main.js callback
        if (typeof window.onMapReady === 'function') {
            window.onMapReady();
        }
    });
}
