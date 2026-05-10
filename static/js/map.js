'use strict';

/* Map module state */
let mapSvg, mapG, mapPath, mapProjection;
let mapWidth, mapHeight;
let countryPaths;
let map_currentIndicator = null;
let map_currentYear = null;
let map_colorScale = null;
let map_valueLookup = {};
let mapZoom;

/* ISO3 ↔ name lookups */
const codeToName = {};
const nameToCode = {};
allData.forEach(d => { codeToName[d.Code] = d.Name; nameToCode[d.Name] = d.Code; });

/* Neutral colour interpolator used by both map and scatterplot */
const MAP_INTERPOLATOR = t => d3.interpolateYlOrBr(1 - t);

/* Tooltip indicator list (details-on-demand) */
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

/* Build per-country value lookup for a given indicator and year */
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

/* Create a sequential colour scale from a value lookup */
function buildColorScale(lookup) {
    const values = Object.values(lookup).filter(v => v !== null);
    if (values.length === 0) return () => '#2a2d3e';
    const [lo, hi] = d3.extent(values);
    return d3.scaleSequential().domain([lo, hi]).interpolator(MAP_INTERPOLATOR);
}

/* Return the current map fill colour for a given ISO3 code */
function getMapColorForCode(code) {
    if (!map_colorScale || !map_valueLookup) return '#2a2d3e';
    const v = map_valueLookup[code];
    return (v == null) ? '#2a2d3e' : map_colorScale(v);
}

/* Draw colour legend with neutral palette */
function drawLegend(lookup) {
    const container = d3.select('#map-legend');
    container.selectAll('*').remove();

    const values = Object.values(lookup).filter(v => v !== null);
    if (values.length === 0) return;

    const [lo, hi] = d3.extent(values);
    const legendW = 220, legendH = 10;

    const svg = container.append('svg')
        .attr('width', legendW + 100)
        .attr('height', 44);

    const defs = svg.append('defs');
    const gradId = 'map-legend-grad';
    const grad = defs.append('linearGradient').attr('id', gradId);
    grad.selectAll('stop')
        .data(d3.range(0, 1.01, 0.1))
        .enter().append('stop')
        .attr('offset', d => `${d * 100}%`)
        .attr('stop-color', d => MAP_INTERPOLATOR(d));

    svg.append('rect')
        .attr('x', 0).attr('y', 6)
        .attr('width', legendW).attr('height', legendH)
        .attr('rx', 3)
        .style('fill', `url(#${gradId})`);

    const fmt = d3.format(hi > 1e6 ? '.2s' : hi > 100 ? ',.0f' : '.2f');
    svg.append('text').attr('x', 0).attr('y', 32)
        .attr('class', 'axis-label').text(fmt(lo));
    svg.append('text').attr('x', legendW).attr('y', 32)
        .attr('class', 'axis-label').attr('text-anchor', 'end').text(fmt(hi));
}

/* Details-on-demand tooltip */
const mapTip = d3.select('#map-tooltip');

function showMapTip(event, d) {
    const code = d.properties ? d.properties.id : null;
    const name = codeToName[code] || d.properties?.name || code || '—';
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
    mapTip.style('left', `${event.clientX + 16}px`).style('top', `${event.clientY - 10}px`);
}

function hideMapTip() { mapTip.classed('visible', false); }

/* Update choropleth colours (enter/update pattern, no redraw) */
function updateMap(indicator, year) {
    if (!countryPaths) return;
    map_currentIndicator = indicator;
    map_currentYear = year;

    map_valueLookup = buildValueLookup(indicator, year);
    map_colorScale = buildColorScale(map_valueLookup);

    countryPaths
        .classed('no-data', d => map_valueLookup[d.properties?.id] == null)
        .transition().duration(350)
        .attr('fill', d => {
            const v = map_valueLookup[d.properties?.id];
            return (v == null) ? '#2a2d3e' : map_colorScale(v);
        });

    d3.select('#map-subtitle').text(`${indicator} · ${year}`);
    drawLegend(map_valueLookup);
}

/* Cross-view highlighting */
function highlightCountry(name) {
    if (!countryPaths) return;
    countryPaths.classed('selected', d => codeToName[d.properties?.id] === name);
}

function highlightCountriesByNames(nameSet) {
    if (!countryPaths) return;
    if (!nameSet || nameSet.size === 0) {
        countryPaths.classed('selected', false).classed('dimmed', false);
    } else {
        countryPaths
            .classed('selected', d => nameSet.has(codeToName[d.properties?.id]))
            .classed('dimmed', d => {
                const n = codeToName[d.properties?.id];
                return n && !nameSet.has(n);
            });
    }
}

function clearMapHighlight() {
    if (!countryPaths) return;
    countryPaths.classed('selected', false).classed('dimmed', false);
}

/* Initialize map with TopoJSON geometry, d3.zoom, and country search */
function initMap() {
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

    /* Zoom behaviour applied to SVG, transforms the inner <g> */
    mapZoom = d3.zoom()
        .scaleExtent([1, 8])
        .on('zoom', function (event) {
            mapG.attr('transform', event.transform);
        });

    mapSvg.call(mapZoom);

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
                showMapTip(event, d);
                const name = codeToName[d.properties?.id];
                if (name) onMapHover(name);
            })
            .on('mousemove', moveMapTip)
            .on('mouseout', function () {
                hideMapTip();
                onMapHoverEnd();
            })
            .on('click', function (event, d) {
                const name = codeToName[d.properties?.id];
                if (name) onMapClick(name);
            });

        if (typeof window.onMapReady === 'function') window.onMapReady();
    });

    /* Populate country search datalist and bind input event */
    initCountrySearch();
}

/* Country search bar: populate datalist and wire up matching */
function initCountrySearch() {
    const datalist = document.getElementById('country-datalist');
    countries.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        datalist.appendChild(opt);
    });

    const searchInput = document.getElementById('country-search');
    searchInput.addEventListener('input', function () {
        const query = this.value.trim();
        if (!query) {
            clearMapHighlight();
            clearScatterHighlight();
            return;
        }
        const matched = countries.find(c => c.toLowerCase() === query.toLowerCase());
        if (matched) {
            onMapClick(matched);
            this.value = '';
            this.blur();
        }
    });
}
