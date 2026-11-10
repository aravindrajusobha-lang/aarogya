import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { LanguageCode } from '../i18n';

interface AsrDistrictMapProps {
  currentLang: LanguageCode;
  authToken?: string | null;
  onPlanCampForVillage?: (village: any) => void;
  onNavigateTab?: (tabId: string) => void;
  onRequireLogin?: (role?: 'asha' | 'doctor') => void;
  onGoToAuth?: () => void;
}

interface MandalInfo {
  mandalId: string;
  mandalName: string;
  nameTe: string;
  revenueDivision: 'Paderu' | 'Rampachodavaram';
  centroid: { latitude: number; longitude: number };
  headquarters: string;
  gramPanchayatCount: number;
  estimatedPopulation: number;
}

interface VillageMarker {
  villageId: string;
  villageName: string;
  nameTe?: string;
  mandal: string;
  panchayat: string;
  tribalHabitation: string;
  censusCode: string;
  populationEstimated: number;
  gpsCoordinates?: { latitude: number; longitude: number };
  healthcareAccessLevel?: 'good' | 'moderate' | 'difficult' | 'remote_cutoff';
  nearestFacilityDistanceKm?: number;
  nearestFacilityName?: string;
  nearestFacilityType?: string;
  screeningCoveragePercent?: number;
  campCount?: number;
  lastCampDate?: string | null;
  verifiedByGovt?: boolean;
}

interface FacilityMarker {
  facilityId: string;
  name: string;
  type: string;
  mandal: string;
  location: string;
  gpsCoordinates: { latitude: number; longitude: number };
  bedCapacity?: number;
}

// Custom Leaflet Pin Icons with Emerald Rainforest Theme
const createPinIcon = (color: string, label: string) =>
  L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div style="
        background: ${color};
        color: #ffffff;
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #ffffff;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      ">
        <span style="transform: rotate(45deg); font-size: 14px; font-weight: bold;">${label}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

export const AsrDistrictMap: React.FC<AsrDistrictMapProps> = ({
  currentLang,
  authToken,
  onPlanCampForVillage,
  onNavigateTab,
  onRequireLogin,
  onGoToAuth: _onGoToAuth,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const mandalsLayerRef = useRef<L.GeoJSON | null>(null);

  const [mandals, setMandals] = useState<MandalInfo[]>([]);
  const [villages, setVillages] = useState<VillageMarker[]>([]);
  const [facilities, setFacilities] = useState<FacilityMarker[]>([]);
  const [camps, setCamps] = useState<any[]>([]);

  const [selectedMandal, setSelectedMandal] = useState<string>('all');
  const [selectedDivision, setSelectedDivision] = useState<'all' | 'Paderu' | 'Rampachodavaram'>('all');
  const [activeCategory, setActiveCategory] = useState<'all' | 'villages' | 'facilities' | 'remote' | 'camps'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Monitor network connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch complete ASR geography data
  useEffect(() => {
    async function loadAsrData() {
      if (!authToken) {
        setIsLoading(false);
        const cachedM = localStorage.getItem('asr_cached_mandals');
        if (cachedM) setMandals(JSON.parse(cachedM));
        const cachedV = localStorage.getItem('asr_cached_villages');
        if (cachedV) setVillages(JSON.parse(cachedV));
        const cachedF = localStorage.getItem('asr_cached_facilities');
        if (cachedF) setFacilities(JSON.parse(cachedF));
        return;
      }
      setIsLoading(true);
      try {
        const headers: Record<string, string> = { Authorization: `Bearer ${authToken}` };

        // 1. Fetch Mandals
        const mandalRes = await fetch('/api/v1/reference/asr/mandals', { headers }).catch(() => null);
        if (mandalRes && mandalRes.ok) {
          const json = await mandalRes.json();
          if (json.data?.mandals) {
            setMandals(json.data.mandals);
            localStorage.setItem('asr_cached_mandals', JSON.stringify(json.data.mandals));
          }
        } else {
          const cached = localStorage.getItem('asr_cached_mandals');
          if (cached) setMandals(JSON.parse(cached));
        }

        // 2. Fetch Villages
        const villageRes = await fetch('/api/v1/reference/asr/villages?limit=500', { headers }).catch(() => null);
        if (villageRes && villageRes.ok) {
          const json = await villageRes.json();
          if (json.data?.villages) {
            setVillages(json.data.villages);
            localStorage.setItem('asr_cached_villages', JSON.stringify(json.data.villages));
          }
        } else {
          const cached = localStorage.getItem('asr_cached_villages');
          if (cached) setVillages(JSON.parse(cached));
        }

        // 3. Fetch Facilities
        const facRes = await fetch('/api/v1/reference/asr/facilities', { headers }).catch(() => null);
        if (facRes && facRes.ok) {
          const json = await facRes.json();
          if (json.data?.facilities) {
            setFacilities(json.data.facilities);
            localStorage.setItem('asr_cached_facilities', JSON.stringify(json.data.facilities));
          }
        } else {
          const cached = localStorage.getItem('asr_cached_facilities');
          if (cached) setFacilities(JSON.parse(cached));
        }

        // 4. Fetch Camps
        const campRes = await fetch('/api/v1/camps', { headers }).catch(() => null);
        if (campRes && campRes.ok) {
          const json = await campRes.json();
          if (json.data?.camps) {
            setCamps(json.data.camps);
          }
        }
      } catch (err) {
        console.error('Failed to fetch ASR District Map data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadAsrData();
  }, [authToken]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || leafletMapRef.current) return;

    // ASR District Center (between Paderu & Rampachodavaram: Lat ~17.85, Lng ~82.35)
    const map = L.map(mapContainerRef.current, {
      center: [17.85, 82.35],
      zoom: 9,
      minZoom: 8,
      maxZoom: 16,
    });

    // Clean OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors | ITDA ASR District Health Initiative',
      maxZoom: 18,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    leafletMapRef.current = map;

    // Load Mandal GeoJSON Polygons from backend
    if (authToken) {
      fetch('/api/v1/map/boundaries/mandals', {
        headers: { Authorization: `Bearer ${authToken}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (json?.data && leafletMapRef.current) {
            const geoJsonLayer = L.geoJSON(json.data, {
              style: (feature) => ({
                color: '#059669', // Emerald forest green
                weight: 2,
                opacity: 0.8,
                fillColor: '#10b981',
                fillOpacity: feature?.properties?.revenueDivision === 'Rampachodavaram' ? 0.12 : 0.08,
                dashArray: '3, 4',
              }),
              onEachFeature: (feature, layer) => {
                const props = feature.properties;
                layer.bindTooltip(
                  `<strong>${props.mandalName} Mandal</strong><br/>Division: ${props.revenueDivision}<br/>GPs: ${props.gramPanchayatCount}`,
                  { permanent: false, direction: 'top' }
                );
                layer.on('click', () => {
                  setSelectedMandal(props.mandalName);
                  if (props.centroid) {
                    leafletMapRef.current?.setView([props.centroid.latitude, props.centroid.longitude], 11, {
                      animate: true,
                    });
                  }
                });
              },
            });
            mandalsLayerRef.current = geoJsonLayer;
            geoJsonLayer.addTo(leafletMapRef.current);
          }
        })
        .catch((err) => console.warn('Could not load mandal polygons:', err));
    }

    return () => {
      map.remove();
      leafletMapRef.current = null;
    };
  }, [authToken]);

  // Filtered dataset based on selection, division, and category
  const filteredVillages = useMemo(() => {
    return villages.filter((v) => {
      // Division filter
      if (selectedDivision !== 'all') {
        const mandalDef = mandals.find((m) => m.mandalName.toLowerCase() === v.mandal.toLowerCase());
        if (mandalDef && mandalDef.revenueDivision !== selectedDivision) return false;
      }
      // Mandal filter
      if (selectedMandal !== 'all' && v.mandal.toLowerCase() !== selectedMandal.toLowerCase()) {
        return false;
      }
      // Category filter
      if (activeCategory === 'facilities') return false;
      if (activeCategory === 'camps') return false;
      if (activeCategory === 'remote') {
        return v.healthcareAccessLevel === 'remote_cutoff' || v.healthcareAccessLevel === 'difficult';
      }
      // Search query
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
  }, [villages, mandals, selectedDivision, selectedMandal, activeCategory, searchQuery]);

  const filteredFacilities = useMemo(() => {
    return facilities.filter((f) => {
      if (activeCategory === 'villages' || activeCategory === 'remote' || activeCategory === 'camps') return false;
      if (selectedMandal !== 'all' && f.mandal.toLowerCase() !== selectedMandal.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return f.name.toLowerCase().includes(q) || f.mandal.toLowerCase().includes(q);
      }
      return true;
    });
  }, [facilities, selectedMandal, activeCategory, searchQuery]);

  const filteredCamps = useMemo(() => {
    return camps.filter((c) => {
      if (activeCategory === 'villages' || activeCategory === 'facilities' || activeCategory === 'remote') return false;
      if (selectedMandal !== 'all' && c.mandal && c.mandal.toLowerCase() !== selectedMandal.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [camps, selectedMandal, activeCategory]);

  // Update Leaflet Markers when filters change
  useEffect(() => {
    if (!markersLayerRef.current) return;
    markersLayerRef.current.clearLayers();

    // 1. Add Village Markers
    filteredVillages.forEach((v) => {
      if (!v.gpsCoordinates?.latitude || !v.gpsCoordinates?.longitude) return;

      const isRemote = v.healthcareAccessLevel === 'remote_cutoff';
      const isDifficult = v.healthcareAccessLevel === 'difficult';
      const pinColor = isRemote ? '#ef4444' : isDifficult ? '#f59e0b' : '#10b981';
      const pinLabel = isRemote ? '⚠️' : '🏡';

      const marker = L.marker([v.gpsCoordinates.latitude, v.gpsCoordinates.longitude], {
        icon: createPinIcon(pinColor, pinLabel),
        title: v.villageName,
      });

      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 13px; min-width: 180px;">
          <h4 style="margin: 0 0 4px 0; color: #065f46; font-size: 15px;">${v.villageName}</h4>
          ${v.nameTe ? `<div style="color: #64748b; font-size: 12px; margin-bottom: 6px;">${v.nameTe}</div>` : ''}
          <div><strong>Mandal:</strong> ${v.mandal}</div>
          <div><strong>Gram Panchayat:</strong> ${v.panchayat}</div>
          <div><strong>Access Level:</strong> <span style="color: ${pinColor}; font-weight: bold;">${v.healthcareAccessLevel || 'Moderate'}</span></div>
          <div><strong>Nearest Facility:</strong> ${v.nearestFacilityDistanceKm || 5} km</div>
          <div style="margin-top: 8px;">
            <button id="btn-pop-select-${v.villageId}" style="
              background: #059669; color: white; border: none; padding: 4px 10px; border-radius: 4px; font-size: 12px; cursor: pointer; width: 100%;
            ">View Details & Plan Camp</button>
          </div>
        </div>
      `);

      marker.on('click', () => {
        setSelectedItem({ ...v, itemType: 'village' });
      });

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-pop-select-${v.villageId}`);
        if (btn) {
          btn.onclick = () => {
            setSelectedItem({ ...v, itemType: 'village' });
          };
        }
      });

      markersLayerRef.current?.addLayer(marker);
    });

    // 2. Add Facility Markers (Hospitals, CHCs, PHCs)
    filteredFacilities.forEach((f) => {
      if (!f.gpsCoordinates?.latitude || !f.gpsCoordinates?.longitude) return;

      const isHospital = f.type === 'district_hospital' || f.type === 'area_hospital';
      const pinColor = isHospital ? '#dc2626' : '#0284c7';
      const pinLabel = '🏥';

      const marker = L.marker([f.gpsCoordinates.latitude, f.gpsCoordinates.longitude], {
        icon: createPinIcon(pinColor, pinLabel),
        title: f.name,
      });

      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 13px; min-width: 180px;">
          <h4 style="margin: 0 0 4px 0; color: #0369a1; font-size: 15px;">${f.name}</h4>
          <div><strong>Type:</strong> ${f.type.toUpperCase().replace('_', ' ')}</div>
          <div><strong>Mandal:</strong> ${f.mandal}</div>
          ${f.bedCapacity ? `<div><strong>Capacity:</strong> ${f.bedCapacity} Beds</div>` : ''}
        </div>
      `);

      marker.on('click', () => {
        setSelectedItem({ ...f, itemType: 'facility' });
      });

      markersLayerRef.current?.addLayer(marker);
    });

    // 3. Add Medical Camp Markers
    filteredCamps.forEach((c) => {
      const lat = c.location?.gpsCoordinates?.latitude;
      const lng = c.location?.gpsCoordinates?.longitude;
      if (!lat || !lng) return;

      const marker = L.marker([lat, lng], {
        icon: createPinIcon('#7c3aed', '🏕️'),
        title: c.name,
      });

      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 13px; min-width: 180px;">
          <h4 style="margin: 0 0 4px 0; color: #6d28d9; font-size: 15px;">${c.name}</h4>
          <div><strong>Status:</strong> ${c.status}</div>
          <div><strong>Target:</strong> ${c.targetPopulation} screened</div>
        </div>
      `);

      marker.on('click', () => {
        setSelectedItem({ ...c, itemType: 'camp' });
      });

      markersLayerRef.current?.addLayer(marker);
    });
  }, [filteredVillages, filteredFacilities, filteredCamps]);

  // Fly to selected item on map
  const handleSelectLocation = (loc: any) => {
    setSelectedItem(loc);
    const lat = loc.gpsCoordinates?.latitude || loc.location?.gpsCoordinates?.latitude || loc.centroid?.latitude;
    const lng = loc.gpsCoordinates?.longitude || loc.location?.gpsCoordinates?.longitude || loc.centroid?.longitude;
    if (lat && lng && leafletMapRef.current) {
      leafletMapRef.current.setView([lat, lng], 13, { animate: true });
    }
  };

  return (
    <div className="asr-map-wrapper">
      {/* Top Banner & Header */}
      <div className="asr-map-header">
        <div className="map-title-row">
          <div className="map-title-badge">
            <span className="district-flag">🇮🇳</span>
            <h2>
              {currentLang === 'te'
                ? 'అల్లూరి సీతారామరాజు (ASR) జిల్లా భౌగోళిక మ్యాప్'
                : currentLang === 'hi'
                ? 'अल्लूरी सीताराम राजू (ASR) जिला भौगोलिक मानचित्र'
                : 'Alluri Sitharama Raju (ASR) District GIS Map'}
            </h2>
            <span className="coverage-badge">
              {mandals.length} {currentLang === 'te' ? 'మండలాలు' : currentLang === 'hi' ? 'मंडल' : 'Mandals'} (100% Covered)
            </span>
            <span className={`network-pill ${isOnline ? 'online' : 'offline'}`}>
              {isOnline ? '● Live Online' : '⚠️ Offline Cache Active'}
            </span>
          </div>

          <div className="map-stat-pills">
            <div className="stat-pill">
              <span className="pill-num">22</span>
              <span className="pill-txt">Mandals</span>
            </div>
            <div className="stat-pill">
              <span className="pill-num">450+</span>
              <span className="pill-txt">Gram Panchayats</span>
            </div>
            <div className="stat-pill">
              <span className="pill-num">{villages.length}</span>
              <span className="pill-txt">Villages Mapped</span>
            </div>
            <div className="stat-pill">
              <span className="pill-num">{facilities.length}</span>
              <span className="pill-txt">Health Facilities</span>
            </div>
          </div>
        </div>

        {!authToken && (
          <div
            style={{
              background: 'rgba(28, 114, 147, 0.15)',
              border: '1px solid rgba(28, 114, 147, 0.35)',
              borderRadius: '8px',
              padding: '8px 16px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              fontSize: '0.86rem',
            }}
          >
            <span>
              👁️ <strong>Guest Preview Mode:</strong> Viewing public boundaries. Sign in to view live clinical screening clusters, priority flags, and micro-planning.
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {onRequireLogin && (
                <>
                  <button
                    type="button"
                    className="button-coral"
                    onClick={() => onRequireLogin('asha')}
                    style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                  >
                    👩‍⚕️ ASHA Demo Login
                  </button>
                  <button
                    type="button"
                    className="button-dark"
                    onClick={() => onRequireLogin('doctor')}
                    style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                  >
                    👨‍⚕️ MO Demo Login
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="map-controls-bar">
          {/* Revenue Division Filter */}
          <div className="control-group">
            <label>Division:</label>
            <div className="segmented-toggle">
              <button
                type="button"
                className={selectedDivision === 'all' ? 'active' : ''}
                onClick={() => setSelectedDivision('all')}
              >
                All (22)
              </button>
              <button
                type="button"
                className={selectedDivision === 'Paderu' ? 'active' : ''}
                onClick={() => setSelectedDivision('Paderu')}
              >
                Paderu (11)
              </button>
              <button
                type="button"
                className={selectedDivision === 'Rampachodavaram' ? 'active' : ''}
                onClick={() => setSelectedDivision('Rampachodavaram')}
              >
                Rampachodavaram (11)
              </button>
            </div>
          </div>

          {/* Mandal Dropdown */}
          <div className="control-group">
            <label>Mandal:</label>
            <select
              value={selectedMandal}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedMandal(val);
                if (val !== 'all') {
                  const m = mandals.find((item) => item.mandalName === val);
                  if (m && leafletMapRef.current) {
                    leafletMapRef.current.setView([m.centroid.latitude, m.centroid.longitude], 11, { animate: true });
                  }
                } else if (leafletMapRef.current) {
                  leafletMapRef.current.setView([17.85, 82.35], 9, { animate: true });
                }
              }}
              className="map-select"
            >
              <option value="all">-- All Mandals ({mandals.length}) --</option>
              {mandals
                .filter((m) => selectedDivision === 'all' || m.revenueDivision === selectedDivision)
                .map((m) => (
                  <option key={m.mandalId} value={m.mandalName}>
                    {m.mandalName} {m.nameTe ? `(${m.nameTe})` : ''} - {m.revenueDivision}
                  </option>
                ))}
            </select>
          </div>

          {/* Category Filter Pills */}
          <div className="control-group">
            <label>Layers:</label>
            <div className="category-pills">
              <button
                type="button"
                className={`cat-pill ${activeCategory === 'all' ? 'active' : ''}`}
                onClick={() => setActiveCategory('all')}
              >
                All Data
              </button>
              <button
                type="button"
                className={`cat-pill ${activeCategory === 'villages' ? 'active' : ''}`}
                onClick={() => setActiveCategory('villages')}
              >
                🏡 Villages ({filteredVillages.length})
              </button>
              <button
                type="button"
                className={`cat-pill ${activeCategory === 'facilities' ? 'active' : ''}`}
                onClick={() => setActiveCategory('facilities')}
              >
                🏥 Hospitals & PHCs
              </button>
              <button
                type="button"
                className={`cat-pill danger ${activeCategory === 'remote' ? 'active' : ''}`}
                onClick={() => setActiveCategory('remote')}
              >
                ⚠️ Remote & Cutoff Hamlets
              </button>
              <button
                type="button"
                className={`cat-pill purple ${activeCategory === 'camps' ? 'active' : ''}`}
                onClick={() => setActiveCategory('camps')}
              >
                🏕️ Screening Camps
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="control-group search-group">
            <input
              type="text"
              placeholder={
                currentLang === 'te'
                  ? 'మండలం, పంచాయతీ లేదా గ్రామం పేరు వెతకండి...'
                  : 'Search Mandal, Panchayat or Village...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="map-search-input"
            />
            {searchQuery && (
              <button type="button" className="clear-search-btn" onClick={() => setSearchQuery('')}>
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Map Body: Interactive Leaflet Map + Location Drawer */}
      <div className="asr-map-layout">
        {/* Leaflet Map Stage */}
        <div className="map-canvas-container">
          <div ref={mapContainerRef} className="leaflet-map-element" />

          {/* Map Overlay Quick Legend */}
          <div className="map-legend-card">
            <h4>{currentLang === 'te' ? 'మ్యాప్ చిహ్నాలు' : 'Map Legend'}</h4>
            <div className="legend-item">
              <span className="legend-dot green"></span>
              <span>Good Access (&le; 5 km)</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot amber"></span>
              <span>Difficult Terrain (5-12 km)</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot red"></span>
              <span>Remote / Monsoon Cutoff (&gt; 12 km)</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot blue"></span>
              <span>District/Area Hospital, CHC, PHC</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot purple"></span>
              <span>Screening Medical Camp</span>
            </div>
          </div>

          {/* Loading Indicator */}
          {isLoading && (
            <div className="map-loading-overlay">
              <div className="spinner"></div>
              <span>Loading Alluri Sitharama Raju District GIS Database...</span>
            </div>
          )}
        </div>

        {/* Side Details / Exploration Panel */}
        <div className="asr-map-sidebar">
          {selectedItem ? (
            <div className="location-detail-card">
              <div className="card-top">
                <span className={`type-tag ${selectedItem.itemType}`}>
                  {selectedItem.itemType === 'village' ? 'Tribal Village' : selectedItem.itemType === 'facility' ? 'Healthcare Centre' : 'Screening Camp'}
                </span>
                <button type="button" className="close-card-btn" onClick={() => setSelectedItem(null)}>
                  ✕
                </button>
              </div>

              <h3>{selectedItem.villageName || selectedItem.name}</h3>
              {selectedItem.nameTe && <h4 className="vernacular-name">{selectedItem.nameTe}</h4>}

              <div className="detail-meta-grid">
                <div className="meta-item">
                  <span className="meta-label">Mandal:</span>
                  <span className="meta-val">{selectedItem.mandal}</span>
                </div>
                {selectedItem.panchayat && (
                  <div className="meta-item">
                    <span className="meta-label">Gram Panchayat:</span>
                    <span className="meta-val">{selectedItem.panchayat}</span>
                  </div>
                )}
                {selectedItem.censusCode && (
                  <div className="meta-item">
                    <span className="meta-label">Census Code:</span>
                    <span className="meta-val">{selectedItem.censusCode}</span>
                  </div>
                )}
                {selectedItem.populationEstimated && (
                  <div className="meta-item">
                    <span className="meta-label">Est. Population:</span>
                    <span className="meta-val">{selectedItem.populationEstimated} residents</span>
                  </div>
                )}
                {selectedItem.tribalHabitation && (
                  <div className="meta-item">
                    <span className="meta-label">Tribal Community:</span>
                    <span className="meta-val">{selectedItem.tribalHabitation}</span>
                  </div>
                )}
                {selectedItem.nearestFacilityDistanceKm !== undefined && (
                  <div className="meta-item">
                    <span className="meta-label">Nearest PHC/CHC:</span>
                    <span className="meta-val">
                      {selectedItem.nearestFacilityDistanceKm} km ({selectedItem.nearestFacilityName || 'Local PHC'})
                    </span>
                  </div>
                )}
                {selectedItem.healthcareAccessLevel && (
                  <div className="meta-item">
                    <span className="meta-label">Access Rating:</span>
                    <span className={`access-badge ${selectedItem.healthcareAccessLevel}`}>
                      {selectedItem.healthcareAccessLevel === 'remote_cutoff'
                        ? '🚨 Remote Monsoon Cutoff'
                        : selectedItem.healthcareAccessLevel === 'difficult'
                        ? '⚠️ Difficult Hill Terrain'
                        : '✅ Road Connected'}
                    </span>
                  </div>
                )}
                {selectedItem.screeningCoveragePercent !== undefined && (
                  <div className="meta-item full-width">
                    <div className="coverage-row">
                      <span className="meta-label">Screening Coverage:</span>
                      <span className="meta-val">{selectedItem.screeningCoveragePercent}%</span>
                    </div>
                    <div className="coverage-bar">
                      <div
                        className="coverage-fill"
                        style={{ width: `${selectedItem.screeningCoveragePercent}%` }}
                      ></div>
                    </div>
                  </div>
                )}
                {selectedItem.verifiedByGovt && (
                  <div className="meta-item full-width verified-badge">
                    <span>🛡️ Verified Andhra Pradesh Government GIS Record</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="detail-actions">
                {selectedItem.itemType === 'village' && (
                  <button
                    type="button"
                    className="btn-plan-camp-primary"
                    onClick={() => {
                      if (onPlanCampForVillage) {
                        onPlanCampForVillage(selectedItem);
                      } else if (onNavigateTab) {
                        onNavigateTab('camp-planning');
                      }
                    }}
                  >
                    🏕️ Plan Medical Camp Here
                  </button>
                )}
                <button
                  type="button"
                  className="btn-center-map-sec"
                  onClick={() => handleSelectLocation(selectedItem)}
                >
                  📍 Center on Map
                </button>
              </div>
            </div>
          ) : (
            <div className="map-explorer-list">
              <div className="explorer-header">
                <h3>
                  {selectedMandal === 'all'
                    ? 'All ASR District Habitations'
                    : `${selectedMandal} Mandal Habitations`}
                </h3>
                <span className="count-pill">{filteredVillages.length} Villages</span>
              </div>
              <p className="explorer-hint">
                Select any village, PHC, or camp to view coordinates, accessibility metrics, and plan field screening.
              </p>

              <div className="explorer-scroll-items">
                {filteredVillages.slice(0, 40).map((v) => (
                  <div
                    key={v.villageId}
                    className="village-list-item"
                    onClick={() => handleSelectLocation(v)}
                  >
                    <div className="item-head">
                      <strong>{v.villageName}</strong>
                      <span className={`mini-badge ${v.healthcareAccessLevel || 'moderate'}`}>
                        {v.nearestFacilityDistanceKm || 5} km
                      </span>
                    </div>
                    <div className="item-sub">
                      <span>{v.mandal} Mandal</span> • <span>{v.panchayat} GP</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
