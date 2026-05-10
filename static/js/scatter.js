/**
 * scatter.js – PCA Scatterplot (Tasks 3, 5, 6)
 *
 * Renders a 2-D PCA scatterplot from pcaData.
 *
 * Interactions:
 *  - Hover  → highlight corresponding country on the map (Task 5)
 *  - NO click (line chart is triggered only from the map)
 *  - d3.brush → rectangular selection → highlight map + update line chart (Task 6)
 *
 * Styling update on indicator change via enter/update pattern (Task 6).
 *
 * Exports: initScatter(), highlightScatterCountry(name),
 *          highlightScatterCountries(nameSet), clearScatterHighlight(),
 *          updateScatterStyling(indicator, year)
 */

'use strict';

/* ── Layout ───────────────────────────────────────────────────────────────── */
const SC_MARGIN = { top: 20, right: 20, bottom: 50, left: 54 };

/* ── Colour palette ───────────────────────────────────────────────────────── */
const DOT_NORMAL   = '#6c8aff';
const DOT_SELECTED = '#34d399';
const DOT_BRUSHED  = '#f59e0b';
const DOT_DIM      = '#2a3050';

/* ── Module state ─────────────────────────────────────────────────────────── */
let scatterSvg, scatterG;
let scW, scH;
let xScale, yScale;
let dots, labels;
let scatterBrush;
let brushedNames = new Set();  // shared with main.js

/* ── Tooltip ─────────────────────────────────────────────────────────────── */
const scTip = d3.select('#scatter-tooltip');

function showScTip(event, d) {
    scTip.html(`
        <div class="tt-country">${d.name}</div>
        <div class="tt-value">PC1: <span>${d.pc1.toFixed(3)}</span></div>
        <div class="tt-value">PC2: <span>${d.pc2.toFixed(3)}</span></div>
    `).classed('visible', true);
    moveScTip(event);
}

function moveScTip(event) {
    const [mx, my] = d3.pointer(event, document.body);
    scTip.style('left', `${mx + 14}px`).style('top', `${my - 10}px`);
}

function hideScTip() { scTip.classed('visible', false); }

/* ── Update explained variance label ─────────────────────────────────────── */
function updateEVLabels() {
    document.getElementById('ev1').textContent = (explainedVar[0] * 100).toFixed(1);
    document.getElementById('ev2').textContent = (explainedVar[1] * 100).toFixed(1);
}

/* ── initScatter ──────────────────────────────────────────────────────────── */
function initScatter() {
    updateEVLabels();

    const svgEl  = document.getElementById('svg_plot');
    const totalW = svgEl.clientWidth  || 460;
    const totalH = svgEl.clientHeight || 460;

    scW = totalW - SC_MARGIN.left - SC_MARGIN.right;
    scH = totalH - SC_MARGIN.top  - SC_MARGIN.bottom;

    scatterSvg = d3.select('#svg_plot')
        .attr('width',  totalW)
        .attr('height', totalH);

    scatterG = scatterSvg.append('g')
        .attr('transform', `translate(${SC_MARGIN.left},${SC_MARGIN.top})`);

    /* ── Scales ───────────────────────────────────────────────────────────── */
    const pc1Ext = d3.extent(pcaData, d => d.pc1);
    const pc2Ext = d3.extent(pcaData, d => d.pc2);
    const pc1Pad = (pc1Ext[1] - pc1Ext[0]) * 0.12;
    const pc2Pad = (pc2Ext[1] - pc2Ext[0]) * 0.12;

    xScale = d3.scaleLinear()
        .domain([pc1Ext[0] - pc1Pad, pc1Ext[1] + pc1Pad])
        .range([0, scW]);

    yScale = d3.scaleLinear()
        .domain([pc2Ext[0] - pc2Pad, pc2Ext[1] + pc2Pad])
        .range([scH, 0]);

    /* ── Grid ─────────────────────────────────────────────────────────────── */
    scatterG.append('g').attr('class', 'sc-grid-h')
        .selectAll('line').data(yScale.ticks(6))
        .enter().append('line').attr('class', 'grid-line')
        .attr('x1', 0).attr('x2', scW)
        .attr('y1', d => yScale(d)).attr('y2', d => yScale(d));

    scatterG.append('g').attr('class', 'sc-grid-v')
        .selectAll('line').data(xScale.ticks(6))
        .enter().append('line').attr('class', 'grid-line')
        .attr('y1', 0).attr('y2', scH)
        .attr('x1', d => xScale(d)).attr('x2', d => xScale(d));

    /* Zero axes */
    scatterG.append('line').attr('class', 'grid-line')
        .attr('x1', xScale(0)).attr('x2', xScale(0))
        .attr('y1', 0).attr('y2', scH)
        .style('stroke', 'rgba(255,255,255,0.15)').style('stroke-dasharray', 'none');

    scatterG.append('line').attr('class', 'grid-line')
        .attr('x1', 0).attr('x2', scW)
        .attr('y1', yScale(0)).attr('y2', yScale(0))
        .style('stroke', 'rgba(255,255,255,0.15)').style('stroke-dasharray', 'none');

    /* ── Axes ──────────────────────────────────────────────────────────────── */
    scatterG.append('g').attr('class', 'x-axis axis')
        .attr('transform', `translate(0,${scH})`)
        .call(d3.axisBottom(xScale).ticks(6).tickSize(-scH))
        .select('.domain').remove();

    scatterG.append('g').attr('class', 'y-axis axis')
        .call(d3.axisLeft(yScale).ticks(6).tickSize(-scW))
        .select('.domain').remove();

    const ev1Pct = (explainedVar[0] * 100).toFixed(1);
    const ev2Pct = (explainedVar[1] * 100).toFixed(1);

    scatterG.append('text').attr('class', 'axis-label')
        .attr('x', scW / 2).attr('y', scH + 40)
        .attr('text-anchor', 'middle')
        .text(`PC 1  (${ev1Pct}% variance)`);

    scatterG.append('text').attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -scH / 2).attr('y', -42)
        .attr('text-anchor', 'middle')
        .text(`PC 2  (${ev2Pct}% variance)`);

    /* ── Dots (enter) ─────────────────────────────────────────────────────── */
    dots = scatterG.selectAll('circle.dot')
        .data(pcaData, d => d.code)
        .enter().append('circle')
        .attr('class', 'dot')
        .attr('id', d => `dot-${d.code}`)
        .attr('cx', d => xScale(d.pc1))
        .attr('cy', d => yScale(d.pc2))
        .attr('r', 5)
        .attr('fill', DOT_NORMAL)
        .attr('stroke', 'rgba(255,255,255,0.25)')
        .attr('stroke-width', 1)
        /* ── Hover → highlight country on map (Task 5) ────────────────── */
        .on('mouseover', function (event, d) {
            showScTip(event, d);
            d3.select(this).raise();
            onScatterHover(d.name);
        })
        .on('mousemove', moveScTip)
        .on('mouseout', function () {
            hideScTip();
            onScatterHoverEnd();
        });
        /* NO click – line chart is triggered only from the map (Task 5) */

    /* ── Labels (enter) ───────────────────────────────────────────────────── */
    labels = scatterG.selectAll('text.dot-label')
        .data(pcaData, d => d.code)
        .enter().append('text')
        .attr('class', 'dot-label')
        .attr('id', d => `label-${d.code}`)
        .attr('x', d => xScale(d.pc1) + 7)
        .attr('y', d => yScale(d.pc2) + 4)
        .text(d => d.code)
        .style('pointer-events', 'none');

    /* ── d3.brush for rectangular selection (Task 6) ──────────────────────── */
    scatterBrush = d3.brush()
        .extent([[0, 0], [scW, scH]])
        .on('brush', onBrushMove)
        .on('end',   onBrushEnd);

    scatterG.append('g')
        .attr('class', 'scatter-brush')
        .call(scatterBrush);
}

/* ── Brush handlers ───────────────────────────────────────────────────────── */
function onBrushMove(event) {
    if (!event.selection) return;
    const [[x0, y0], [x1, y1]] = event.selection;

    brushedNames = new Set();
    dots.each(function (d) {
        const cx = xScale(d.pc1);
        const cy = yScale(d.pc2);
        if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) {
            brushedNames.add(d.name);
        }
    });

    // Highlight in scatterplot
    applyBrushHighlight();

    // Highlight on map
    highlightCountriesByNames(brushedNames);
}

function onBrushEnd(event) {
    if (!event.selection) {
        // Brush cleared → reset
        brushedNames = new Set();
        clearScatterHighlight();
        clearMapHighlight();
        onBrushCleared();
        return;
    }
    // Final brush selection → update line chart for all brushed countries
    onBrushSelection(brushedNames);
}

/* ── Apply brushing visual state ──────────────────────────────────────────── */
function applyBrushHighlight() {
    if (brushedNames.size === 0) {
        dots
            .attr('fill', DOT_NORMAL)
            .attr('r', 5)
            .attr('stroke', 'rgba(255,255,255,0.25)')
            .attr('stroke-width', 1)
            .classed('dimmed', false);
        labels.style('opacity', 0.4).classed('highlighted', false);
        return;
    }
    dots
        .attr('fill', d => brushedNames.has(d.name) ? DOT_BRUSHED : DOT_DIM)
        .attr('r',    d => brushedNames.has(d.name) ? 7 : 4)
        .attr('stroke', d => brushedNames.has(d.name) ? '#fff' : 'rgba(255,255,255,0.1)')
        .attr('stroke-width', d => brushedNames.has(d.name) ? 1.5 : 0.5)
        .classed('dimmed', d => !brushedNames.has(d.name));

    labels
        .classed('highlighted', d => brushedNames.has(d.name))
        .style('opacity', d => brushedNames.has(d.name) ? 1 : 0.15);
}

/* ── Single-country hover highlight (from map hover) ─────────────────────── */
function highlightScatterCountry(name) {
    if (brushedNames.size > 0) return; // don't override brush
    dots
        .attr('fill', d => d.name === name ? DOT_SELECTED : DOT_NORMAL)
        .attr('r',    d => d.name === name ? 8 : 5)
        .attr('stroke', d => d.name === name ? '#fff' : 'rgba(255,255,255,0.25)')
        .attr('stroke-width', d => d.name === name ? 2 : 1);

    labels
        .classed('highlighted', d => d.name === name)
        .style('opacity', d => d.name === name ? 1 : 0.4);

    if (name) {
        scatterG.selectAll('circle.dot')
            .filter(d => d.name === name).raise();
    }
}

/** Highlight a SET of country names (used by brushing). */
function highlightScatterCountries(nameSet) {
    brushedNames = nameSet;
    applyBrushHighlight();
}

function clearScatterHighlight() {
    brushedNames = new Set();
    dots
        .attr('fill', DOT_NORMAL)
        .attr('r', 5)
        .attr('stroke', 'rgba(255,255,255,0.25)')
        .attr('stroke-width', 1)
        .classed('dimmed', false);
    labels.style('opacity', 0.4).classed('highlighted', false);
}

/**
 * Task 6 – Indicator-based styling update (enter/update pattern).
 * Colour-encode each dot by the currently selected indicator's value.
 */
function updateScatterStyling(indicator, year) {
    if (!dots) return;
    if (brushedNames.size > 0) return; // don't override brush colours

    // Build a value lookup for the chosen indicator & year
    const lookup = {};
    allData.forEach(d => {
        if (d.Year === year) {
            const v = d[indicator];
            if (v !== null && v !== undefined && !isNaN(v)) lookup[d.Code] = +v;
        }
    });

    const values = Object.values(lookup);
    if (values.length === 0) return;

    const [lo, hi] = d3.extent(values);
    const scale = d3.scaleSequential()
        .domain([lo, hi])
        .interpolator(d3.interpolatePlasma);

    // Update (transition, no redraw) – enter/update pattern with existing selection
    dots.transition().duration(400)
        .attr('fill', d => {
            const v = lookup[d.code];
            return (v !== undefined) ? scale(v) : DOT_NORMAL;
        });
}
