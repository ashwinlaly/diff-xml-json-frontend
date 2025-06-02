import React, { useState, useCallback } from 'react';
import './XmlJsonComparator.css';


const XmlJsonComparator = () => {
    const [xmlContent, setXmlContent] = useState('');
    const [jsonContent, setJsonContent] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [results, setResults] = useState(null);
    const [messages, setMessages] = useState([]);

    const exportIssues = async () => {
        if (!xmlContent.trim() || !jsonContent.trim()) {
            showMessage('Please provide both XML and JSON content before exporting', 'error');
            return;
        }

        try {
            setIsLoading(true);

            const response = await fetch('http://localhost:8000/api/export-issues', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    xml_content: xmlContent,
                    json_content: jsonContent
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Export failed');
            }

            // Download the file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `xml_json_comparison_issues_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showMessage('✅ Issues report exported successfully!', 'success');

        } catch (error) {
            console.error('Export error:', error);
            showMessage(`Export failed: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const showMessage = useCallback((message, type) => {
        const newMessage = {
            id: Date.now(),
            text: message,
            type: type
        };

        setMessages(prev => [...prev, newMessage]);

        setTimeout(() => {
            setMessages(prev => prev.filter(msg => msg.id !== newMessage.id));
        }, 5000);
    }, []);

    const compareData = async () => {
        if (!xmlContent.trim() || !jsonContent.trim()) {
            showMessage('Please provide both XML and JSON content', 'error');
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch('http://localhost:8000/api/compare', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    xml_content: xmlContent,
                    json_content: jsonContent
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Comparison failed');
            }

            const comparisonResults = await response.json();
            setResults(comparisonResults);
            setShowResults(true);

            if (comparisonResults.is_modernization_complete) {
                showMessage('✅ Modernization is complete! All XML data found in JSON.', 'success');
            } else {
                showMessage(`⚠️ Modernization incomplete. ${comparisonResults.summary.missing_fields} fields missing.`, 'warning');
            }

        } catch (error) {
            console.error('Comparison error:', error);
            showMessage(`Error: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const clearXML = () => setXmlContent('');
    const clearJSON = () => setJsonContent('');
    const clearResults = () => {
        setShowResults(false);
        setResults(null);
        setMessages([]);
    };

    const formatXMLString = (xml) => {
        const formatted = xml.replace(/>\s*</g, '>\n<');
        const lines = formatted.split('\n');
        let indent = 0;
        let formattedXml = '';

        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith('</')) {
                indent--;
            }

            formattedXml += '  '.repeat(Math.max(0, indent)) + trimmed + '\n';

            if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.endsWith('/>')) {
                indent++;
            }
        });

        return formattedXml.trim();
    };

    const formatXML = () => {
        if (xmlContent.trim()) {
            try {
                const formatted = formatXMLString(xmlContent);
                setXmlContent(formatted);
                showMessage('XML formatted successfully!', 'success');
            } catch (error) {
                showMessage('Invalid XML format', 'error');
            }
        }
    };

    const validateXML = () => {
        if (!xmlContent.trim()) {
            showMessage('Please enter XML content first', 'error');
            return;
        }

        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
            const errors = xmlDoc.getElementsByTagName('parsererror');

            if (errors.length > 0) {
                showMessage('XML is invalid: ' + errors[0].textContent, 'error');
            } else {
                showMessage('XML is valid!', 'success');
            }
        } catch (error) {
            showMessage('XML validation failed: ' + error.message, 'error');
        }
    };

    const validateJSON = () => {
        if (!jsonContent.trim()) {
            showMessage('Please enter JSON content first', 'error');
            return;
        }

        try {
            JSON.parse(jsonContent);
            showMessage('JSON is valid!', 'success');
        } catch (error) {
            showMessage('JSON is invalid: ' + error.message, 'error');
        }
    };

    const formatJSON = () => {
        if (jsonContent.trim()) {
            try {
                const parsed = JSON.parse(jsonContent);
                const formatted = JSON.stringify(parsed, null, 2);
                setJsonContent(formatted);
                showMessage('JSON formatted successfully!', 'success');
            } catch (error) {
                showMessage('Invalid JSON format', 'error');
            }
        }
    };

    const renderFieldComparison = (comparison) => {
        const statusColors = {
            'match': '#10b981',
            'missing_in_json': '#ef4444',
            'value_mismatch': '#f59e0b',
            'type_mismatch': '#8b5cf6'
        };

        return (
            <div
                key={comparison.path}
                className="field-comparison"
                style={{ borderLeft: `4px solid ${statusColors[comparison.status]}` }}
            >
                <div className="field-path">{comparison.path}</div>
                <div className="field-values">
                    <div className="xml-value">
                        <strong>XML:</strong> {comparison.xml_value !== null ? JSON.stringify(comparison.xml_value) : 'null'}
                    </div>
                    <div className="json-value">
                        <strong>JSON:</strong> {comparison.json_value !== null ? JSON.stringify(comparison.json_value) : 'null'}
                    </div>
                </div>
                <div className={`field-status status-${comparison.status}`}>
                    {comparison.message}
                </div>
            </div>
        );
    };

    return (
        <div className="comparator-container">
            <div className="header">
                <h1>XML → JSON Modernization Validator</h1>
                <p>Ensure your JSON modernization preserves all XML data</p>
            </div>

            <div className="main-content">
                <div className="input-section">
                    <div className="input-group">
                        <label className="input-label">
                            <span className="label-icon xml-icon"></span>
                            Legacy XML Data
                        </label>
                        <div className="utility-buttons">
                            <button className="utility-button" onClick={clearXML}>Clear</button>
                            <button className="utility-button" onClick={formatXML}>Format</button>
                            <button className="utility-button" onClick={validateXML}>
                                Validate
                            </button>
                        </div>
                        <textarea
                            className="input-textarea xml-textarea"
                            value={xmlContent}
                            onChange={(e) => setXmlContent(e.target.value)}
                            placeholder={`Paste your legacy XML here...

Example:
<GOASIS-RESULT-LIT>OASIS RESULT:</GOASIS-RESULT-LIT>
<DLR-LANG-RESP>
    <RET-LANG-CODE>EN</RET-LANG-CODE>
    <RET-LANG-DESC>ENGLISH</RET-LANG-DESC>
    <LANG-RESP-MSG/>
</DLR-LANG-RESP>`}
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">
                            <span className="label-icon json-icon"></span>
                            Modernized JSON Data
                        </label>
                        <div className="utility-buttons">
                            <button className="utility-button" onClick={clearJSON}>Clear</button>
                            <button className="utility-button" onClick={formatJSON}>Format</button>
                            <button className="utility-button" onClick={validateJSON}>
                                Validate
                            </button>
                        </div>
                        <textarea
                            className="input-textarea json-textarea"
                            value={jsonContent}
                            onChange={(e) => setJsonContent(e.target.value)}
                            placeholder={`Paste your modernized JSON here...

Example:
{
  "msgDesc": "Success",
  "response": {
    "GOASIS-RESULT-LIT": "OASIS RESULT:",
    "DLR-LANG-RESP": {
      "RET-LANG-CODE": "EN",
      "RET-LANG-DESC": "ENGLISH",
      "LANG-RESP-MSG": ""
    }
  }
}`}
                        />
                    </div>
                </div>

                <div className="action-section">
                    <button
                        className="compare-button"
                        onClick={compareData}
                        disabled={isLoading}
                    >
                        {isLoading ? '🔄 Validating Modernization...' : '🔍 Validate Modernization'}
                    </button>
                    {/*<button*/}
                    {/*    className="export-button"*/}
                    {/*    onClick={exportIssues}*/}
                    {/*    disabled={isLoading || !showResults}*/}
                    {/*    style={{*/}
                    {/*        background: '#4CAF50',*/}
                    {/*        color: 'white',*/}
                    {/*        border: 'none',*/}
                    {/*        padding: '15px 30px',*/}
                    {/*        fontSize: '1rem',*/}
                    {/*        fontWeight: '600',*/}
                    {/*        borderRadius: '50px',*/}
                    {/*        cursor: 'pointer',*/}
                    {/*        marginLeft: '15px',*/}
                    {/*        opacity: (!showResults || isLoading) ? 0.5 : 1*/}
                    {/*    }}*/}
                    {/*>*/}
                    {/*    📊 Export Issues Report*/}
                    {/*</button>*/}
                </div>

                {isLoading && (
                    <div className="loading">
                        <div className="loading-spinner"></div>
                        <p>Analyzing XML → JSON modernization...</p>
                    </div>
                )}

                {/* Messages */}
                {messages.map(message => (
                    <div
                        key={message.id}
                        className={`message ${message.type === 'error' ? 'error-message' :
                            message.type === 'warning' ? 'warning-message' : 'success-message'}`}
                    >
                        {message.text}
                    </div>
                ))}

                {/* Results Section */}
                {showResults && results && (
                    <div className="results-section">
                        <div className="results-header">
                            <h3 className="results-title">
                                Modernization Validation Results
                                {results.is_modernization_complete ?
                                    <span className="status-badge success">✅ Complete</span> :
                                    <span className="status-badge incomplete">⚠️ Incomplete</span>
                                }
                            </h3>
                            <button className="clear-button" onClick={clearResults}>
                                Clear Results
                            </button>
                        </div>

                        <div className="results-content">
                            {/* Summary Stats */}
                            <div className="summary-grid">
                                <div className="summary-item">
                                    <div className="summary-value">{results.summary.total_xml_fields}</div>
                                    <div className="summary-label">XML Fields</div>
                                </div>
                                <div className="summary-item">
                                    <div className="summary-value">{results.summary.matching_fields}</div>
                                    <div className="summary-label">Matching</div>
                                </div>
                                <div className="summary-item">
                                    <div className="summary-value">{results.summary.missing_fields}</div>
                                    <div className="summary-label">Missing</div>
                                </div>
                                <div className="summary-item">
                                    <div className="summary-value">{results.summary.completion_percentage}%</div>
                                    <div className="summary-label">Complete</div>
                                </div>
                            </div>

                            {/* Missing Fields Alert */}
                            {results.missing_fields.length > 0 && (
                                <div className="missing-fields-alert">
                                    <h4>⚠️ Missing Fields in JSON:</h4>
                                    <ul>
                                        {results.missing_fields.map(field => (
                                            <li key={field}>{field}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Field Comparisons */}
                            <div className="field-comparisons">
                                <h4>Field-by-Field Comparison:</h4>
                                <div className="comparisons-list">
                                    {results.field_comparisons.map(renderFieldComparison)}
                                </div>
                            </div>

                            {/* Extra JSON Fields */}
                            {results.extra_fields.length > 0 && (
                                <div className="extra-fields-info">
                                    <h4>ℹ️ Additional JSON Fields (not in XML):</h4>
                                    <div className="extra-fields-list">
                                        {results.extra_fields.map(field => (
                                            <span key={field} className="extra-field-tag">{field}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default XmlJsonComparator;
