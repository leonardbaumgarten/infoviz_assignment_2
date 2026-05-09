/**
 * scatter.js – PCA Scatterplot (Task 3)
 *
 * Renders a 2-D PCA scatterplot from pcaData (computed server-side in Task 2).
 * Each dot represents one country projected onto PC1 / PC2.
 *
 * Exports:  initScatter(), highlightScatterCountry(name)
 * Calls:    onCountrySelected(name)  – defined in main.js
 */

'use strict';

/* ── Layout ───────────────────────────────────────────────────────────────── */
const SC_MARGIN = { top: 20, right: 20, bottom: 50, left: 54 };

/* ── Colour palette – same hue as accent, differentiating by region group ── */
// Simple two-colour scheme: emphasise selected, dim others
const DOT_NORMAL   = '#6c8aff';
const DOT_SELECTED = '#34d399';
const DOT_DIM      = '#2a3050';

/* ── Module state ─────────────────────────────────────────────────────────── */
let scatterSvg, scatterG;
let scW, scH;
let xScale, yScale;
let dots, labels;
let selectedScatterCountry = null;

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

    const svgEl = document.getElementById('svg_plot');
    const totalW = svgEl.clientWidth  || 460;
    const totalH = svgEl.clientHeight || 460;

    scW = totalW - SC_MARGIN.left - SC_MARGIN.right;
    scH = totalH - SC_MARGIN.top  - SC_MARGIN.bottom;

    scatterSvg = d3.select('#svg_plot')
        .attr('width',  totalW)
        .attr('height', totalH);

    scatterG = scatterSvg.append('g')
        .attr('transform', `translate(${SC_MARGIN.left},${SC_MARGIN.top})`);

    /* Scales */
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

    /* Grid lines */
    scatterG.append('g')
        .attr('class', 'grid-lines')
        .selectAll('line.grid-line-h')
        .data(yScale.ticks(6))
        .enter().append('line')
        .attr('class', 'grid-line')
        .attr('x1', 0).attr('x2', scW)
        .attr('y1', d => yScale(d)).attr('y2', d => yScale(d));

    scatterG.append('g')
        .attr('class', 'grid-lines')
        .selectAll('line.grid-line-v')
        .data(xScale.ticks(6))
        .enter().append('line')
        .attr('class', 'grid-line')
        .attr('y1', 0).attr('y2', scH)
        .attr('x1', d => xScale(d)).attr('x2', d => xScale(d));

    /* Zero axes */
    scatterG.append('line')
        .attr('class', 'grid-line')
        .attr('x1', xScale(0)).attr('x2', xScale(0))
        .attr('y1', 0).attr('y2', scH)
        .style('stroke', 'rgba(255,255,255,0.15)').style('stroke-dasharray', 'none');

    scatterG.append('line')
        .attr('class', 'grid-line')
        .attr('x1', 0).attr('x2', scW)
        .attr('y1', yScale(0)).attr('y2', yScale(0))
        .style('stroke', 'rgba(255,255,255,0.15)').style('stroke-dasharray', 'none');

    /* Axes */
    const xAxis = d3.axisBottom(xScale).ticks(6).tickSize(-scH);
    const yAxis = d3.axisLeft(yScale).ticks(6).tickSize(-scW);

    scatterG.append('g')
        .attr('class', 'x-axis axis')
        .attr('transform', `translate(0,${scH})`)
        .call(xAxis)
        .select('.domain').remove();

    scatterG.append('g')
        .attr('class', 'y-axis axis')
        .call(yAxis)
        .select('.domain').remove();

    // Axis labels with explained variance
    const ev1Pct = (explainedVar[0] * 100).toFixed(1);
    const ev2Pct = (explainedVar[1] * 100).toFixed(1);

    scatterG.append('text')
        .attr('class', 'axis-label')
        .attr('x', scW / 2)
        .attr('y', scH + 40)
        .attr('text-anchor', 'middle')
        .text(`PC 1  (${ev1Pct}% variance)`);

    scatterG.append('text')
        .attr('class', 'axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -scH / 2)
        .attr('y', -42)
        .attr('text-anchor', 'middle')
        .text(`PC 2  (${ev2Pct}% variance)`);

    /* ── Dots ─────────────────────────────────────────────────────────────── */
    dots = scatterG.selectAll('circle.dot')
        .data(pcaData)
        .enter().append('circle')
        .attr('class', 'dot')
        .attr('id', d => `dot-${d.code}`)
        .attr('cx', d => xScale(d.pc1))
        .attr('cy', d => yScale(d.pc2))
        .attr('r', 5)
        .attr('fill', DOT_NORMAL)
        .attr('stroke', 'rgba(255,255,255,0.25)')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('mouseover', function (event, d) {
            showScTip(event, d);
            d3.select(this).raise();
        })
        .on('mousemove', moveScTip)
        .on('mouseout',  hideScTip)
        .on('click', function (event, d) {
            onCountrySelected(d.name);
        });

    /* ── Labels (country codes) ───────────────────────────────────────────── */
    labels = scatterG.selectAll('text.dot-label')
        .data(pcaData)
        .enter().append('text')
        .attr('class', 'dot-label')
        .attr('id', d => `label-${d.code}`)
        .attr('x', d => xScale(d.pc1) + 7)
        .attr('y', d => yScale(d.pc2) + 4)
        .text(d => d.code)
        .style('pointer-events', 'none');
}

/* ── Highlight a country in the scatterplot ──────────────────────────────── */
function highlightScatterCountry(name) {
    selectedScatterCountry = name;

    dots
        .attr('fill', d => d.name === name ? DOT_SELECTED : DOT_NORMAL)
        .attr('r',    d => d.name === name ? 8 : 5)
        .attr('stroke', d => d.name === name ? '#fff' : 'rgba(255,255,255,0.25)')
        .attr('stroke-width', d => d.name === name ? 2 : 1);

    labels
        .classed('highlighted', d => d.name === name)
        .style('opacity', d => d.name === name ? 1 : 0.4);

    // Bring selected dot to front
    if (name) {
        scatterG.selectAll('circle.dot')
            .filter(d => d.name === name)
            .raise();
    }
}
