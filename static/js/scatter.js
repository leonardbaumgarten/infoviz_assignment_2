'use strict';

/* Layout and colour constants */
const SC_MARGIN = { top: 20, right: 20, bottom: 50, left: 54 };
const DOT_DIM = '#2a3050';
const DOT_FALLBACK = '#6c8aff';

/* Module state */
let scatterSvg, scatterG;
let scW, scH;
let xScale, yScale;
let dots, labels;
let scatterBrush;
let brushedNames = new Set();
let scatterColorFn = null;

/* Tooltip */
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
    scTip.style('left', `${event.clientX + 14}px`).style('top', `${event.clientY - 10}px`);
}

function hideScTip() { scTip.classed('visible', false); }

/* Resting fill: uses map-synced colour or fallback */
function dotRestingFill(d) {
    return scatterColorFn ? scatterColorFn(d) : DOT_FALLBACK;
}

function updateEVLabels() {
    document.getElementById('ev1').textContent = (explainedVar[0] * 100).toFixed(1);
    document.getElementById('ev2').textContent = (explainedVar[1] * 100).toFixed(1);
}

/* Initialize PCA scatterplot */
function initScatter() {
    updateEVLabels();

    const svgEl = document.getElementById('svg_plot');
    const totalW = svgEl.clientWidth || 460;
    const totalH = svgEl.clientHeight || 460;

    scW = totalW - SC_MARGIN.left - SC_MARGIN.right;
    scH = totalH - SC_MARGIN.top - SC_MARGIN.bottom;

    scatterSvg = d3.select('#svg_plot')
        .attr('width', totalW)
        .attr('height', totalH);

    scatterG = scatterSvg.append('g')
        .attr('transform', `translate(${SC_MARGIN.left},${SC_MARGIN.top})`);

    /* D3 scales */
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

    scatterG.append('line').attr('class', 'grid-line')
        .attr('x1', xScale(0)).attr('x2', xScale(0))
        .attr('y1', 0).attr('y2', scH)
        .style('stroke', 'rgba(255,255,255,0.15)').style('stroke-dasharray', 'none');

    scatterG.append('line').attr('class', 'grid-line')
        .attr('x1', 0).attr('x2', scW)
        .attr('y1', yScale(0)).attr('y2', yScale(0))
        .style('stroke', 'rgba(255,255,255,0.15)').style('stroke-dasharray', 'none');

    /* Axes */
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

    /* Brush layer (rendered underneath dots) */
    scatterBrush = d3.brush()
        .extent([[0, 0], [scW, scH]])
        .on('brush', onBrushMove)
        .on('end', onBrushEnd);

    scatterG.append('g')
        .attr('class', 'scatter-brush')
        .call(scatterBrush);

    /* Dots (on top of brush for pointer events) */
    dots = scatterG.selectAll('circle.dot')
        .data(pcaData, d => d.code)
        .enter().append('circle')
        .attr('class', 'dot')
        .attr('id', d => `dot-${d.code}`)
        .attr('cx', d => xScale(d.pc1))
        .attr('cy', d => yScale(d.pc2))
        .attr('r', 5)
        .attr('fill', DOT_FALLBACK)
        .attr('stroke', 'rgba(255,255,255,0.25)')
        .attr('stroke-width', 1)
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

    /* Country code labels */
    labels = scatterG.selectAll('text.dot-label')
        .data(pcaData, d => d.code)
        .enter().append('text')
        .attr('class', 'dot-label')
        .attr('id', d => `label-${d.code}`)
        .attr('x', d => xScale(d.pc1) + 7)
        .attr('y', d => yScale(d.pc2) + 4)
        .text(d => d.code)
        .style('pointer-events', 'none');

    /* Clear brush button */
    document.getElementById('clear-brush-btn').addEventListener('click', function () {
        d3.select('.scatter-brush').call(scatterBrush.move, null);
    });
}

/* Brush event handlers */
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

    applyBrushHighlight();
    highlightCountriesByNames(brushedNames);
}

function onBrushEnd(event) {
    if (!event.selection) {
        brushedNames = new Set();
        clearScatterHighlight();
        clearMapHighlight();
        onBrushCleared();
        return;
    }
    onBrushSelection(brushedNames);
}

/* Visual state for active brush selection */
function applyBrushHighlight() {
    if (brushedNames.size === 0) {
        dots
            .attr('fill', d => dotRestingFill(d))
            .attr('r', 5)
            .attr('stroke', 'rgba(255,255,255,0.25)')
            .attr('stroke-width', 1)
            .classed('dimmed', false);
        labels.style('opacity', 0.4).classed('highlighted', false);
        return;
    }
    dots
        .attr('fill', d => brushedNames.has(d.name) ? dotRestingFill(d) : DOT_DIM)
        .attr('r', d => brushedNames.has(d.name) ? 8 : 4)
        .attr('stroke', d => brushedNames.has(d.name) ? '#ffffff' : 'rgba(255,255,255,0.1)')
        .attr('stroke-width', d => brushedNames.has(d.name) ? 2.5 : 0.5)
        .classed('dimmed', d => !brushedNames.has(d.name));

    labels
        .classed('highlighted', d => brushedNames.has(d.name))
        .style('opacity', d => brushedNames.has(d.name) ? 1 : 0.15);
}

/* Single-country hover highlight (colorblind-safe: white stroke + enlarged radius, keeps data fill) */
function highlightScatterCountry(name) {
    if (brushedNames.size > 0) return;
    dots
        .attr('fill', d => dotRestingFill(d))
        .attr('r', d => d.name === name ? 9 : 5)
        .attr('stroke', d => d.name === name ? '#ffffff' : 'rgba(255,255,255,0.25)')
        .attr('stroke-width', d => d.name === name ? 3 : 1);

    labels
        .classed('highlighted', d => d.name === name)
        .style('opacity', d => d.name === name ? 1 : 0.4);

    if (name) {
        scatterG.selectAll('circle.dot')
            .filter(d => d.name === name).raise();
    }
}

function highlightScatterCountries(nameSet) {
    brushedNames = nameSet;
    applyBrushHighlight();
}

function clearScatterHighlight() {
    brushedNames = new Set();
    dots
        .attr('fill', d => dotRestingFill(d))
        .attr('r', 5)
        .attr('stroke', 'rgba(255,255,255,0.25)')
        .attr('stroke-width', 1)
        .classed('dimmed', false);
    labels.style('opacity', 0.4).classed('highlighted', false);
}

/* Sync scatterplot dot colours with map colour scale (uses YlOrRd from map.js) */
function updateScatterStyling(indicator, year) {
    if (!dots) return;
    if (brushedNames.size > 0) return;

    scatterColorFn = d => getMapColorForCode(d.code);

    dots.transition().duration(400)
        .attr('fill', d => scatterColorFn(d));
}
