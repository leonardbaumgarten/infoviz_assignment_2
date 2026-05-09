from flask import Flask, render_template
import json
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

app = Flask(__name__)

# ensure that we can reload when we change the HTML / JS for debugging
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.config['TEMPLATES_AUTO_RELOAD'] = True

# ── Task 1: List of 48 countries ──────────────────────────────────────────────
COUNTRIES = [
    'Afghanistan', 'Albania', 'Algeria', 'Angola', 'Argentina', 'Armenia', 
    'Australia', 'Austria', 'Azerbaijan', 'Brazil', 'Bulgaria', 'Cameroon', 
    'Chile', 'China', 'Colombia', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 
    'Ecuador', 'Egypt, Arab Rep.', 'Eritrea', 'Ethiopia', 'France', 'Germany', 
    'Ghana', 'Greece', 'India', 'Indonesia', 'Iran, Islamic Rep.', 'Iraq', 
    'Ireland', 'Italy', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Lebanon', 
    'Malta', 'Mexico', 'Morocco', 'Pakistan', 'Peru', 'Philippines', 
    'Russian Federation', 'Syrian Arab Republic', 'Tunisia', 'Turkey', 'Ukraine'
]

# ── Task 1: Load and filter the dataset ──────────────────────────────────────
df_raw = pd.read_csv('static/data/agriRuralDevelopment_clean.csv')
df = df_raw[df_raw['Name'].isin(COUNTRIES)].copy()

# Identify numeric feature columns (exclude metadata)
FEATURE_COLS = [c for c in df.columns if c not in ['Name', 'Code', 'Year']]


def compute_pca(year=None):
    """
    Task 2: Server-side PCA on the filtered dataset.
    Uses the most recent available year if year is None.
    Returns list of dicts with keys: name, code, pc1, pc2.
    Also returns explained variance ratio.
    """
    if year is None:
        year = int(df['Year'].max())

    df_year = df[df['Year'] == year].copy()

    X = df_year[FEATURE_COLS].values.astype(float)

    # Standardise features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Reduce to 2 principal components
    pca = PCA(n_components=2)
    coords = pca.fit_transform(X_scaled)

    explained = pca.explained_variance_ratio_.tolist()

    records = []
    for i, row in enumerate(df_year.itertuples(index=False)):
        records.append({
            'name': row.Name,
            'code': row.Code,
            'pc1':  float(coords[i, 0]),
            'pc2':  float(coords[i, 1]),
        })

    return records, explained, year


@app.route('/')
def index():
    # Task 1: pass full (filtered) dataset as JSON
    data = df.to_dict(orient='records')

    # Task 2: PCA on most recent year
    pca_data, explained_var, pca_year = compute_pca()

    return render_template(
        'index.html',
        data=json.dumps(data),
        pca_data=json.dumps(pca_data),
        explained_var=json.dumps(explained_var),
        pca_year=pca_year,
        indicators=json.dumps(FEATURE_COLS),
        countries=json.dumps(COUNTRIES),
    )


if __name__ == '__main__':
    app.run(debug=True)


# TODO: Task 5: PCA plot link zu world map und anders herum: land/punkt soll durch hovern angezeigt werden, nicht durch klicken
# TODO: Task 5: Change of variable über Jahre soll nur angezeigt werden, wenn man auf ein Land in der Map klickt (nicht auch, wenn man auf einen Punkt im scatter plot klickt)
# TODO: Task 6: Year dropdown gegen year slider austauschen und die konfiguration des year-sliders soll auch time-series lineplot "entsprechend anpassen"
# TODO: Task 6: Auswahl des features muss auch "styling of the scatterplot" ändern
# TODO: Task 6: Verifizieren, ob "All updates must use d3’s enter/update pattern and charts must not be fully redrawn." erfüllt ist
# TODO: Task 6: brushing komplett, Bonus: komplett
# TODO: Task 6: Color Themes sinnvoll anpassen