/**
 * map.js – Choropleth world map (Tasks 4 & 5)
 *
 * Draws a world map, colour-encodes countries by a selected indicator.
 *
 * Interactions:
 *  - Hover  → highlight dot in scatterplot (Task 5)
 *  - Click  → show time-series line chart   (Task 5)
 *
 * Bonus: details-on-demand tooltip showing 8 variable values.
 *
 * Exports: initMap(), updateMap(indicator, year), highlightCountry(name),
 *          highlightCountriesByNames(nameSet), clearMapHighlight()
 */

'use strict';

/* ── Module-level state ───────────────────────────────────────────────────── */
let mapSvg, mapG, mapPath, mapProjection;
let mapWidth, mapHeight;
let countryPaths;

let map_currentIndicator = null;
let map_currentYear      = null;
let map_colorScale       = null;

/* ── Build ISO3→name lookup from allData ─────────────────────────────────── */
const codeToName = {};
const nameToCode = {};
allData.forEach(d => { codeToName[d.Code] = d.Name; nameToCode[d.Name] = d.Code; });

/* The 8 indicators shown in the details-on-demand tooltip (Bonus) */
const TOOLTIP_INDICATORS = [
    'GDP per capita (current US$)',
    'Population, total',
    'Rural population (% of total population)',
    'Agricultural land (% of land area)',
    'Forest area (% of land area)',
    'Employment in agriculture (% of total employment) (modeled ILO estimate)',
    'Arable land (% of land area)',
    'Crop production index (2004-2006 = 100)'
];

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

    const defs   = svg.append('defs');
    const gradId = 'map-legend-grad';
    const grad   = defs.append('linearGradient').attr('id', gradId);
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

/* ── Tooltip (Bonus: Details-on-Demand with 8 variables) ─────────────────── */
const mapTip = d3.select('#map-tooltip');

function showMapTip(event, d) {
    const code = d.properties ? d.properties.id : null;
    const name = codeToName[code] || d.properties?.name || code || '—';

    // Find the most-recent-year row for this country
    const mostRecentYear = d3.max(allData, r => r.Year);
    const row = allData.find(r => r.Code === code && r.Year === mostRecentYear);

    let html = `<div class="tt-country">${name}</div>`;

    if (row) {
        html += `<div class="tt-value" style="margin-bottom:4px;color:#8892a4;font-size:0.68rem;">Year: <span>${mostRecentYear}</span></div>`;
        TOOLTIP_INDICATORS.forEach(ind => {
            const v = row[ind];
            const label = ind.length > 38 ? ind.substring(0, 38) + '…' : ind;
            if (v !== null && v !== undefined && !isNaN(v)) {
                const fmt = Math.abs(+v) > 1e6 ? '.3s' : Math.abs(+v) > 100 ? ',.0f' : '.3f';
                html += `<div class="tt-value">${label}: <span>${d3.format(fmt)(+v)}</span></div>`;
            } else {
                html += `<div class="tt-value">${label}: <em style="color:#4a5568">N/A</em></div>`;
            }
        });
    } else {
        html += `<div class="tt-value"><em style="color:#4a5568">No data</em></div>`;
    }

    mapTip.html(html).classed('visible', true);
    moveMapTip(event);
}

function moveMapTip(event) {
    const [mx, my] = d3.pointer(event, document.body);
    mapTip.style('left', `${mx + 16}px`).style('top', `${my - 10}px`);
}

function hideMapTip() { mapTip.classed('visible', false); }

/* ── Map update (called when indicator or year changes) ─────────────────── */
function updateMap(indicator, year) {
    if (!countryPaths) return;
    map_currentIndicator = indicator;
    map_currentYear      = year;

    const lookup = buildValueLookup(indicator, year);
    map_colorScale = buildColorScale(lookup);

    // enter/update – use transition, do NOT redraw elements
    countryPaths
        .classed('no-data', d => lookup[d.properties?.id] == null)
        .transition().duration(350)
        .attr('fill', d => {
            const v = lookup[d.properties?.id];
            return (v == null) ? '#2a2d3e' : map_colorScale(v);
        });

    d3.select('#map-subtitle').text(`${indicator} · ${year}`);
    drawLegend(lookup);
}

/* ── Highlight helpers ───────────────────────────────────────────────────── */
function highlightCountry(name) {
    if (!countryPaths) return;
    countryPaths.classed('selected', d => codeToName[d.properties?.id] === name);
}

/** Highlight a SET of country names (used by brushing). */
function highlightCountriesByNames(nameSet) {
    if (!countryPaths) return;
    if (!nameSet || nameSet.size === 0) {
        countryPaths.classed('selected', false).classed('dimmed', false);
    } else {
        countryPaths
            .classed('selected', d => nameSet.has(codeToName[d.properties?.id]))
            .classed('dimmed',   d => {
                const n = codeToName[d.properties?.id];
                return n && !nameSet.has(n);
            });
    }
}

function clearMapHighlight() {
    if (!countryPaths) return;
    countryPaths.classed('selected', false).classed('dimmed', false);
}

/* ── initMap ─────────────────────────────────────────────────────────────── */
function initMap() {
    const svgEl = document.getElementById('svg_map');
    mapWidth  = svgEl.clientWidth  || 820;
    mapHeight = svgEl.clientHeight || 460;

    mapSvg = d3.select('#svg_map')
        .attr('width',  mapWidth)
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
            /* ── Hover → highlight corresponding dot in scatterplot (Task 5) ── */
            .on('mouseover', function (event, d) {
                showMapTip(event, d);
                const name = codeToName[d.properties?.id];
                if (name) onMapHover(name);
            })
            .on('mousemove', moveMapTip)
            .on('mouseout', function (event, d) {
                hideMapTip();
                onMapHoverEnd();
            })
            /* ── Click → show time-series line chart (Task 5) ────────────── */
            .on('click', function (event, d) {
                const code = d.properties?.id;
                const name = codeToName[code];
                if (name) onMapClick(name);
            });

        // Signal that the map geometry is ready
        if (typeof window.onMapReady === 'function') window.onMapReady();
    });
}
