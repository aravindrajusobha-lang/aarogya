import React, { useState, useEffect } from 'react';
import { LanguageCode } from '../i18n';
import { AuthUser } from './AuthPanel';
import { LoginRequiredView } from './UIStateViews';

interface LocationAdminManagerProps {
  currentLang: LanguageCode;
  currentUser: AuthUser | null;
  authToken?: string;
  onRequireLogin?: (role?: 'asha' | 'doctor') => void;
  onGoToAuth?: () => void;
}

export const LocationAdminManager: React.FC<LocationAdminManagerProps> = ({
  currentLang,
  currentUser,
  authToken,
  onRequireLogin,
  onGoToAuth,
}) => {
  const isAdmin = currentUser?.role === 'system_admin' || currentUser?.role === 'admin';
  const [activeTab, setActiveTab] = useState<'villages' | 'mandals' | 'facilities' | 'import'>('villages');
  const [mandals, setMandals] = useState<any[]>([]);
  const [villages, setVillages] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [selectedMandal, setSelectedMandal] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add Village Form
  const [newVillageName, setNewVillageName] = useState('');
  const [newVillageNameTe, setNewVillageNameTe] = useState('');
  const [newMandal, setNewMandal] = useState('Paderu');
  const [newPanchayat, setNewPanchayat] = useState('');
  const [newHabitation, setNewHabitation] = useState('');
  const [newCensusCode, setNewCensusCode] = useState('');
  const [newPopulation, setNewPopulation] = useState(500);
  const [newLat, setNewLat] = useState<string>('18.0821');
  const [newLng, setNewLng] = useState<string>('82.6612');
  const [newAccessLevel, setNewAccessLevel] = useState<'good' | 'moderate' | 'difficult' | 'remote_cutoff'>('moderate');
  const [newFacilityDist, setNewFacilityDist] = useState<number>(5);

  // Edit Coordinates Modal / Inline
  const [editingVillage, setEditingVillage] = useState<any | null>(null);
  const [editLat, setEditLat] = useState<number>(0);
  const [editLng, setEditLng] = useState<number>(0);

  // CSV Import
  const [csvText, setCsvText] = useState<string>(
    'villageName,nameTe,mandal,panchayat,tribalHabitation,censusCode,populationEstimated,latitude,longitude,healthcareAccessLevel,nearestFacilityDistanceKm\n' +
      'Kudumulagunta,కుడుములగుంట,Paderu,Vankachinta,Bagata Habitation,584920,480,18.0912,82.6712,moderate,4.5\n' +
      'Gondipakalu,గొండిపాకలు,Chintapalli,G.K. Veedhi,Valmiki Settlement,584921,360,17.9234,82.3512,difficult,11.2\n' +
      'Posammagandi,పోచమ్మగండి,Devipatnam,Devipatnam,Konda Reddi Cutoff,584922,620,17.3912,81.6912,remote_cutoff,16.5'
  );
  const [importSummary, setImportSummary] = useState<any | null>(null);

  const getHeaders = () => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) h['Authorization'] = `Bearer ${authToken}`;
    return h;
  };

  const loadData = async () => {
    if (!authToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // 1. Mandals
      const mRes = await fetch('/api/v1/reference/asr/mandals', { headers: getHeaders() });
      if (mRes.ok) {
        const json = await mRes.json();
        if (json.data?.mandals) setMandals(json.data.mandals);
      }

      // 2. Villages
      const vRes = await fetch('/api/v1/reference/asr/villages?limit=500', { headers: getHeaders() });
      if (vRes.ok) {
        const json = await vRes.json();
        if (json.data?.villages) setVillages(json.data.villages);
      }

      // 3. Facilities
      const fRes = await fetch('/api/v1/reference/asr/facilities', { headers: getHeaders() });
      if (fRes.ok) {
        const json = await fRes.json();
        if (json.data?.facilities) setFacilities(json.data.facilities);
      }
    } catch (err) {
      console.error('Failed to load admin location data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [authToken]);

  // Handle Add Single Village
  const handleAddVillage = async (e: React.FormEvent) => {
    e.preventDefault();
    const villageId = `vil_${newMandal.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const payload = {
      villageId,
      villageName: newVillageName,
      nameTe: newVillageNameTe,
      mandal: newMandal,
      panchayat: newPanchayat || newVillageName,
      tribalHabitation: newHabitation || 'Tribal Settlement',
      hospitalId: 'hosp_paderu_dh',
      censusCode: newCensusCode || `CEN${Math.floor(100000 + Math.random() * 900000)}`,
      populationEstimated: Number(newPopulation),
      gpsCoordinates: {
        latitude: parseFloat(newLat) || 18.08,
        longitude: parseFloat(newLng) || 82.66,
      },
      healthcareAccessLevel: newAccessLevel,
      nearestFacilityDistanceKm: Number(newFacilityDist),
      verifiedByGovt: true,
      simulation: true,
    };

    try {
      const res = await fetch('/api/v1/reference/villages', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.data) {
        setNotification({ type: 'success', text: `Village ${newVillageName} added successfully!` });
        setNewVillageName('');
        setNewVillageNameTe('');
        setNewPanchayat('');
        setNewHabitation('');
        loadData();
      } else {
        setNotification({ type: 'error', text: json.error?.message || 'Failed to add village.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Error creating village.' });
    }
  };

  // Update Coordinates
  const handleUpdateCoordinates = async () => {
    if (!editingVillage) return;
    try {
      const res = await fetch(`/api/v1/reference/asr/villages/${editingVillage.villageId}/coordinates`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ latitude: editLat, longitude: editLng }),
      });
      const json = await res.json();
      if (res.ok) {
        setNotification({ type: 'success', text: `Updated GPS coordinates for ${editingVillage.villageName}!` });
        setEditingVillage(null);
        loadData();
      } else {
        setNotification({ type: 'error', text: json.error?.message || 'Failed to update coordinates.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Error updating coordinates.' });
    }
  };

  // CSV Import Parser
  const handleImportCsv = async () => {
    try {
      const lines = csvText.trim().split('\n');
      if (lines.length < 2) {
        setNotification({ type: 'error', text: 'CSV must include header and at least one data row.' });
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim());
      const rows: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const vals = line.split(',').map((v) => v.trim());
        const row: any = {};
        headers.forEach((h, idx) => {
          row[h] = vals[idx];
        });

        rows.push({
          villageName: row.villageName,
          nameTe: row.nameTe,
          mandal: row.mandal,
          panchayat: row.panchayat,
          tribalHabitation: row.tribalHabitation,
          censusCode: row.censusCode,
          populationEstimated: row.populationEstimated ? Number(row.populationEstimated) : 500,
          healthcareAccessLevel: row.healthcareAccessLevel || 'moderate',
          nearestFacilityDistanceKm: row.nearestFacilityDistanceKm ? Number(row.nearestFacilityDistanceKm) : 5,
          gpsCoordinates: {
            latitude: row.latitude ? parseFloat(row.latitude) : 18.08,
            longitude: row.longitude ? parseFloat(row.longitude) : 82.66,
          },
          verifiedByGovt: true,
        });
      }

      setLoading(true);
      const res = await fetch('/api/v1/reference/asr/villages/import', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ villages: rows }),
      });

      const json = await res.json();
      if (res.ok && json.data) {
        setImportSummary(json.data);
        setNotification({
          type: 'success',
          text: `Import completed! Inserted: ${json.data.insertedCount}, Updated: ${json.data.updatedCount}, Skipped: ${json.data.skippedCount}`,
        });
        loadData();
      } else {
        setNotification({ type: 'error', text: json.error?.message || 'CSV Import failed.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Error processing CSV import.' });
    } finally {
      setLoading(false);
    }
  };

  // Filtered villages
  const filteredVillages = villages.filter((v) => {
    if (selectedMandal !== 'all' && v.mandal.toLowerCase() !== selectedMandal.toLowerCase()) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        v.villageName.toLowerCase().includes(q) ||
        (v.nameTe && v.nameTe.includes(q)) ||
        v.panchayat.toLowerCase().includes(q) ||
        v.mandal.toLowerCase().includes(q) ||
        v.censusCode.includes(q)
      );
    }
    return true;
  });

  if (!authToken) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <LoginRequiredView
          moduleTitle="Location Administration & GIS Master Data"
          moduleDescription="Administrative management of mandals, habitations, and healthcare facilities requires verified administrative credentials."
          onLoginAsAsha={() => onRequireLogin?.('asha')}
          onLoginAsDoctor={() => onRequireLogin?.('doctor')}
          onGoToAuth={onGoToAuth}
        />
      </div>
    );
  }

  return (
    <div className="location-admin-container">
      {/* Header */}
      <div className="location-admin-header">
        <div className="header-titles">
          <span className="badge-nature">
            🌐 Official Administrative Directory {isAdmin ? `• ${currentUser?.fullName || 'Administrator'}` : ''}
          </span>
          <h2>
            {currentLang === 'te'
              ? 'పరిపాలనా భౌగోళిక సమాచార నిర్వహణ'
              : currentLang === 'hi'
              ? 'प्रशासनिक भौगोलिक सूचना प्रबंधन'
              : 'ASR District Administrative Location Management'}
          </h2>
          <p className="header-desc">
            Manage Mandals, Gram Panchayats, Villages, GPS Coordinates, and Healthcare Facilities across Alluri Sitharama Raju District.
          </p>
        </div>

        {/* Tab Pills */}
        <div className="planning-tab-pills">
          <button
            type="button"
            className={activeTab === 'villages' ? 'active' : ''}
            onClick={() => setActiveTab('villages')}
          >
            🏡 Villages & Hamlets ({villages.length})
          </button>
          <button
            type="button"
            className={activeTab === 'mandals' ? 'active' : ''}
            onClick={() => setActiveTab('mandals')}
          >
            🏛️ Mandals ({mandals.length})
          </button>
          <button
            type="button"
            className={activeTab === 'facilities' ? 'active' : ''}
            onClick={() => setActiveTab('facilities')}
          >
            🏥 Facilities ({facilities.length})
          </button>
          <button
            type="button"
            className={activeTab === 'import' ? 'active' : ''}
            onClick={() => setActiveTab('import')}
          >
            📥 CSV / Bulk Import
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div className={`feedback-alert ${notification.type}`}>
          <span>{notification.type === 'success' ? '✅' : '⚠️'}</span>
          <span>{notification.text}</span>
          <button type="button" onClick={() => setNotification(null)}>
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: Villages & Hamlets */}
      {activeTab === 'villages' && (
        <div className="admin-tab-content">
          {/* Add Village Card */}
          <div className="admin-card">
            <h3>➕ Add New Verified Village / Habitation</h3>
            <form className="add-village-grid-form" onSubmit={handleAddVillage}>
              <div className="form-group">
                <label>Village Name (English) *</label>
                <input
                  type="text"
                  required
                  value={newVillageName}
                  onChange={(e) => setNewVillageName(e.target.value)}
                  placeholder="e.g. Gurthedu"
                />
              </div>

              <div className="form-group">
                <label>Village Name (తెలుగు Vernacular)</label>
                <input
                  type="text"
                  value={newVillageNameTe}
                  onChange={(e) => setNewVillageNameTe(e.target.value)}
                  placeholder="ఉదా: గుర్తేడు"
                />
              </div>

              <div className="form-group">
                <label>Mandal *</label>
                <select value={newMandal} onChange={(e) => setNewMandal(e.target.value)}>
                  {mandals.map((m) => (
                    <option key={m.mandalId} value={m.mandalName}>
                      {m.mandalName} ({m.revenueDivision})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Gram Panchayat *</label>
                <input
                  type="text"
                  required
                  value={newPanchayat}
                  onChange={(e) => setNewPanchayat(e.target.value)}
                  placeholder="Gram Panchayat name"
                />
              </div>

              <div className="form-group">
                <label>Tribal Habitation Group</label>
                <input
                  type="text"
                  value={newHabitation}
                  onChange={(e) => setNewHabitation(e.target.value)}
                  placeholder="e.g. Konda Reddi settlement"
                />
              </div>

              <div className="form-group">
                <label>Census Code</label>
                <input
                  type="text"
                  value={newCensusCode}
                  onChange={(e) => setNewCensusCode(e.target.value)}
                  placeholder="e.g. 584950"
                />
              </div>

              <div className="form-group">
                <label>Est. Population</label>
                <input
                  type="number"
                  value={newPopulation}
                  onChange={(e) => setNewPopulation(Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>Access Rating</label>
                <select
                  value={newAccessLevel}
                  onChange={(e: any) => setNewAccessLevel(e.target.value)}
                >
                  <option value="good">Good (&le; 5 km)</option>
                  <option value="moderate">Moderate (5-12 km)</option>
                  <option value="difficult">Difficult Terrain (12-20 km)</option>
                  <option value="remote_cutoff">Remote Monsoon Cutoff (&gt; 20 km)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Distance to Nearest Health Facility (km)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newFacilityDist}
                  onChange={(e) => setNewFacilityDist(Number(e.target.value))}
                />
              </div>

              <div className="form-group">
                <label>GPS Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={newLat}
                  onChange={(e) => setNewLat(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>GPS Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={newLng}
                  onChange={(e) => setNewLng(e.target.value)}
                />
              </div>

              <div className="form-group button-group">
                <button type="submit" className="btn-add-entity">
                  ➕ Save Village to MongoDB
                </button>
              </div>
            </form>
          </div>

          {/* Villages Directory Table */}
          <div className="admin-card">
            <div className="table-controls-row">
              <h3>🏡 Mapped Habitations in ASR District</h3>
              <div className="filters-right">
                <select
                  value={selectedMandal}
                  onChange={(e) => setSelectedMandal(e.target.value)}
                  className="mandal-select-sm"
                >
                  <option value="all">-- All Mandals ({mandals.length}) --</option>
                  {mandals.map((m) => (
                    <option key={m.mandalId} value={m.mandalName}>
                      {m.mandalName}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Search village name, census code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input-sm"
                />
              </div>
            </div>

            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Village Name</th>
                    <th>Mandal</th>
                    <th>Panchayat</th>
                    <th>Census Code</th>
                    <th>Pop.</th>
                    <th>Facility Dist.</th>
                    <th>Access</th>
                    <th>GPS Coordinates</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVillages.slice(0, 50).map((v) => (
                    <tr key={v.villageId}>
                      <td>
                        <strong>{v.villageName}</strong>
                        {v.nameTe && <div style={{ fontSize: '11px', color: '#64748b' }}>{v.nameTe}</div>}
                      </td>
                      <td>{v.mandal}</td>
                      <td>{v.panchayat}</td>
                      <td>{v.censusCode}</td>
                      <td>{v.populationEstimated}</td>
                      <td>{v.nearestFacilityDistanceKm || 5} km</td>
                      <td>
                        <span className={`access-pill ${v.healthcareAccessLevel || 'moderate'}`}>
                          {v.healthcareAccessLevel || 'moderate'}
                        </span>
                      </td>
                      <td>
                        {v.gpsCoordinates ? (
                          <span style={{ fontSize: '12px' }}>
                            {v.gpsCoordinates.latitude.toFixed(4)}, {v.gpsCoordinates.longitude.toFixed(4)}
                          </span>
                        ) : (
                          <span style={{ color: '#ef4444', fontSize: '12px' }}>Missing GPS</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-edit-coords"
                          onClick={() => {
                            setEditingVillage(v);
                            setEditLat(v.gpsCoordinates?.latitude || 18.08);
                            setEditLng(v.gpsCoordinates?.longitude || 82.66);
                          }}
                        >
                          ✏️ Edit GPS
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit Coordinates Modal */}
      {editingVillage && (
        <div className="modal-backdrop">
          <div className="edit-coords-modal">
            <h3>✏️ Update GPS Coordinates</h3>
            <p>
              Updating location for <strong>{editingVillage.villageName}</strong> ({editingVillage.mandal} Mandal)
            </p>

            <div className="form-group">
              <label>Latitude:</label>
              <input
                type="number"
                step="0.0001"
                value={editLat}
                onChange={(e) => setEditLat(parseFloat(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label>Longitude:</label>
              <input
                type="number"
                step="0.0001"
                value={editLng}
                onChange={(e) => setEditLng(parseFloat(e.target.value))}
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setEditingVillage(null)}>
                Cancel
              </button>
              <button type="button" className="btn-save" onClick={handleUpdateCoordinates}>
                Save to Database
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Mandals Directory */}
      {activeTab === 'mandals' && (
        <div className="admin-tab-content">
          <div className="admin-card">
            <h3>🏛️ All 22 Mandals of Alluri Sitharama Raju (ASR) District</h3>
            <p className="card-hint">
              Divided into Paderu and Rampachodavaram Revenue Divisions. Verified official administrative boundaries.
            </p>

            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Mandal Name</th>
                    <th>తెలుగు</th>
                    <th>हिन्दी</th>
                    <th>Division</th>
                    <th>Headquarters</th>
                    <th>GPs</th>
                    <th>Catchment Facility</th>
                    <th>Centroid (Lat, Lng)</th>
                  </tr>
                </thead>
                <tbody>
                  {mandals.map((m) => (
                    <tr key={m.mandalId}>
                      <td><strong>{m.mandalName}</strong></td>
                      <td>{m.nameTe}</td>
                      <td>{m.nameHi}</td>
                      <td>
                        <span className={`div-pill ${m.revenueDivision}`}>{m.revenueDivision}</span>
                      </td>
                      <td>{m.headquarters}</td>
                      <td>{m.gramPanchayatCount}</td>
                      <td>{m.catchmentHospitalName}</td>
                      <td>{m.centroid.latitude.toFixed(4)}, {m.centroid.longitude.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Healthcare Facilities Directory */}
      {activeTab === 'facilities' && (
        <div className="admin-tab-content">
          <div className="admin-card">
            <h3>🏥 Government Hospitals, CHCs & PHCs in ASR District</h3>
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Facility Name</th>
                    <th>Type</th>
                    <th>Mandal</th>
                    <th>Location Landmark</th>
                    <th>Beds</th>
                    <th>GPS Coordinates</th>
                  </tr>
                </thead>
                <tbody>
                  {facilities.map((f) => (
                    <tr key={f.facilityId}>
                      <td><strong>{f.name}</strong></td>
                      <td>
                        <span className="fac-type-pill">{f.type.toUpperCase().replace('_', ' ')}</span>
                      </td>
                      <td>{f.mandal}</td>
                      <td>{f.location}</td>
                      <td>{f.bedCapacity || 10}</td>
                      <td>{f.gpsCoordinates.latitude.toFixed(4)}, {f.gpsCoordinates.longitude.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CSV Bulk Import */}
      {activeTab === 'import' && (
        <div className="admin-tab-content">
          <div className="admin-card">
            <h3>📥 Bulk Geographical Import (CSV / Excel format)</h3>
            <p className="card-hint">
              Paste or upload comma-separated village records. Duplicates will be detected and updated without creating ghost records.
            </p>

            <textarea
              rows={10}
              className="csv-textarea"
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />

            <div className="import-action-bar">
              <button
                type="button"
                className="btn-primary-import"
                onClick={handleImportCsv}
                disabled={loading}
              >
                {loading ? 'Importing & Validating...' : '🚀 Validate & Import to MongoDB'}
              </button>
            </div>

            {importSummary && (
              <div className="import-summary-card">
                <h4>Import Results:</h4>
                <div>✅ Inserted new: <strong>{importSummary.insertedCount}</strong></div>
                <div>🔄 Updated existing: <strong>{importSummary.updatedCount}</strong></div>
                <div>⏭️ Skipped invalid: <strong>{importSummary.skippedCount}</strong></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
