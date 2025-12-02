import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { LineChart, BarChart, PieChart } from 'react-charts';
import './App.css';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

function App() {
  const [dashboardData, setDashboardData] = useState(null);
  const [datasetData, setDatasetData] = useState({});
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [selectedDataset, setSelectedDataset] = useState(null);

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to analytics server');
      fetchDashboard();
      fetchReports();
    });

    newSocket.on('data:new', (newDataPoint) => {
      console.log('New data received:', newDataPoint);
      setDashboardData(prev => ({
        ...prev,
        latestData: [newDataPoint, ...(prev?.latestData || [])].slice(0, 100)
      }));
    });

    newSocket.on('data:stream:response', (data) => {
      setDatasetData(prev => ({
        ...prev,
        [selectedDataset]: data
      }));
    });

    return () => newSocket.disconnect();
  }, [selectedDataset]);

  const fetchDashboard = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/analytics/dashboard');
      const data = await response.json();
      setDashboardData(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/reports');
      const data = await response.json();
      setReports(data);
    } catch (err) {
      console.error('Error fetching reports:', err);
    }
  };

  const handleStreamData = (datasetId) => {
    setSelectedDataset(datasetId);
    socket?.emit('data:stream', datasetId);
  };

  if (loading) {
    return <div className="loading">Loading analytics dashboard...</div>;
  }

  return (
    <div className="App">
      <header className="dashboard-header">
        <h1>📊 InsightHub Analytics Dashboard</h1>
        <div className="stats">
          <div className="stat-card">
            <h3>Total Data Points</h3>
            <p>{dashboardData?.totalDataPoints || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Total Reports</h3>
            <p>{dashboardData?.reportCount || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Last Update</h3>
            <p>{new Date(dashboardData?.timestamp).toLocaleTimeString()}</p>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="data-visualization">
          <h2>Real-Time Data Visualization</h2>
          <div className="chart-container">
            {dashboardData?.latestData && dashboardData.latestData.length > 0 && (
              <div className="chart">
                <h3>Latest Data Trends</h3>
                <LineChart
                  data={dashboardData.latestData}
                  xAccessor={(d) => new Date(d.timestamp)}
                  yAccessor={(d) => d.value}
                />
              </div>
            )}
          </div>
        </section>

        <section className="reports">
          <h2>Analytics Reports</h2>
          <div className="reports-grid">
            {reports.length > 0 ? (
              reports.map(report => (
                <div key={report._id} className="report-card">
                  <h3>{report.title}</h3>
                  <p>{report.description}</p>
                  <span className="chart-type">{report.chartType}</span>
                  <button onClick={() => handleStreamData(report.datasetIds[0])}>
                    View Data
                  </button>
                </div>
              ))
            ) : (
              <p>No reports available</p>
            )}
          </div>
        </section>

        {selectedDataset && datasetData[selectedDataset] && (
          <section className="dataset-view">
            <h2>Dataset: {selectedDataset}</h2>
            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Value</th>
                    <th>Category</th>
                  </tr>
                </thead>
                <tbody>
                  {datasetData[selectedDataset].map((item, idx) => (
                    <tr key={idx}>
                      <td>{new Date(item.timestamp).toLocaleString()}</td>
                      <td>{item.value}</td>
                      <td>{item.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
