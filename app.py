from flask import Flask, render_template
import json
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

app = Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0
app.config['TEMPLATES_AUTO_RELOAD'] = True

# Selected countries for analysis
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

# Load and filter dataset
df_raw = pd.read_csv('static/data/agriRuralDevelopment_clean.csv')
df = df_raw[df_raw['Name'].isin(COUNTRIES)].copy()
FEATURE_COLS = [c for c in df.columns if c not in ['Name', 'Code', 'Year']]


def compute_pca(year=None):
    """Perform PCA dimensionality reduction on the dataset for a given year."""
    if year is None:
        year = int(df['Year'].max())

    df_year = df[df['Year'] == year].copy()
    X = df_year[FEATURE_COLS].values.astype(float)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    pca = PCA(n_components=2)
    coords = pca.fit_transform(X_scaled)
    explained = pca.explained_variance_ratio_.tolist()

    records = []
    for i, row in enumerate(df_year.itertuples(index=False)):
        records.append({
            'name': row.Name,
            'code': row.Code,
            'pc1': float(coords[i, 0]),
            'pc2': float(coords[i, 1]),
        })

    return records, explained, year


@app.route('/')
def index():
    data = df.to_dict(orient='records')
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
