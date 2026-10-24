import React, { useCallback, useEffect, useRef, useState } from 'react';
import eventBus from '../EventBus';

type LoadingProps = {};

const LoadingScreen: React.FC<LoadingProps> = () => {
    const [progress, setProgress] = useState(0);
    const [toLoad, setToLoad] = useState(19);
    const [loaded, setLoaded] = useState(0);
    const [overlayOpacity, setLoadingOverlayOpacity] = useState(1);
    const [overlayTransform, setOverlayTransform] = useState('scale(1)');
    const [isHidden, setIsHidden] = useState(false);
    const [webGLErrorOpacity, setWebGLErrorOpacity] = useState(0);

    const [showBiosInfo, setShowBiosInfo] = useState(false);
    const [showLoadingResources, setShowLoadingResources] = useState(false);
    const [doneLoading, setDoneLoading] = useState(false);
    const [webGLError, setWebGLError] = useState(false);
    const [memoryKb, setMemoryKb] = useState(0);
    const [resources] = useState<string[]>([]);
    const startedRef = useRef(false);

    // RAM counter animation
    useEffect(() => {
        const memInterval = setInterval(() => {
            setMemoryKb((prev) => {
                if (prev >= 65536) {
                    clearInterval(memInterval);
                    return 65536;
                }
                return Math.min(65536, prev + 2048);
            });
        }, 28);
        return () => clearInterval(memInterval);
    }, []);

    const start = useCallback(() => {
        if (startedRef.current) return;
        startedRef.current = true;

        setLoadingOverlayOpacity(0);
        setOverlayTransform('scale(1.05)');
        eventBus.dispatch('loadingScreenDone', {});

        const ui = document.getElementById('ui');
        if (ui) {
            ui.style.pointerEvents = 'none';
        }

        setTimeout(() => {
            setIsHidden(true);
        }, 950);
    }, []);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('debug')) {
            start();
        } else if (!detectWebGLContext()) {
            setWebGLError(true);
        } else {
            setShowBiosInfo(true);
        }
    }, [start]);

    useEffect(() => {
        eventBus.on('loadedSource', (data) => {
            setProgress(data.progress);
            setToLoad(data.toLoad);
            setLoaded(data.loaded);
            resources.push(
                `Loaded ${data.sourceName}${getSpace(
                    data.sourceName
                )} ... ${Math.round(data.progress * 100)}%`
            );
            if (resources.length > 5) {
                resources.shift();
            }
        });
    }, [resources]);

    useEffect(() => {
        setShowLoadingResources(true);
    }, [loaded]);

    // Automated boot sequence on full load (1.45s hold, ~1s later than initial 450ms)
    useEffect(() => {
        if (progress >= 1 && !webGLError && !startedRef.current) {
            setDoneLoading(true);
            setMemoryKb(65536);

            const autoTimer = setTimeout(() => {
                start();
            }, 1450);

            return () => clearTimeout(autoTimer);
        }
    }, [progress, webGLError, start]);

    // Fast-forward keyboard shortcut listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
                if (progress >= 1 && !startedRef.current) {
                    start();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [progress, start]);

    useEffect(() => {
        if (webGLError) {
            setTimeout(() => {
                setWebGLErrorOpacity(1);
            }, 500);
        }
    }, [webGLError]);

    const getSpace = (sourceName: string) => {
        let spaces = '';
        for (let i = 0; i < 24 - sourceName.length; i++) spaces += '\xa0';
        return spaces;
    };

    const getCurrentDate = () => {
        const date = new Date();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const year = date.getFullYear();
        const monthFormatted = month < 10 ? `0${month}` : month;
        const dayFormatted = day < 10 ? `0${day}` : day;
        return `${monthFormatted}/${dayFormatted}/${year}`;
    };

    const detectWebGLContext = () => {
        const canvas = document.createElement('canvas');
        const gl =
            canvas.getContext('webgl') ||
            canvas.getContext('experimental-webgl');
        return Boolean(gl && gl instanceof WebGLRenderingContext);
    };

    const renderProgressBar = () => {
        const totalBars = 24;
        const filled = Math.min(totalBars, Math.round(progress * totalBars));
        const empty = totalBars - filled;
        return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${Math.round(progress * 100)}%`;
    };

    if (isHidden) {
        return null;
    }

    return (
        <div
            className="crt-overlay-wrapper"
            style={Object.assign({}, styles.overlay, {
                opacity: overlayOpacity,
                transform: overlayTransform,
            })}
            onClick={() => {
                if (progress >= 1 && !startedRef.current) {
                    start();
                }
            }}
        >
            <div className="crt-scanlines" />
            <div className="crt-vignette" />

            {!webGLError && (
                <div style={styles.overlayText}>
                    <div style={styles.header} className="loading-screen-header">
                        <div style={styles.logoContainer}>
                            <div
                                style={{
                                    border: '2px solid #00aa00',
                                    padding: '4px 8px',
                                    textAlign: 'center',
                                    backgroundColor: '#000',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                }}
                            >
                                <svg
                                    width="64"
                                    height="28"
                                    viewBox="0 0 64 28"
                                    style={{ display: 'block', margin: '0 auto' }}
                                >
                                    <g fill="#00ff66">
                                        <path
                                            d="M 4 10 C 14 7, 26 5, 38 4 C 28 8, 18 10, 8 13 Z"
                                            opacity="0.9"
                                        />
                                        <path
                                            d="M 2 15 C 16 13, 32 10, 44 8 C 30 13, 16 16, 6 18 Z"
                                            opacity="0.95"
                                        />
                                        <path
                                            d="M 4 20 C 16 19, 28 17, 40 15 C 28 19, 16 22, 8 23 Z"
                                            opacity="0.9"
                                        />
                                        <polygon points="46,2 48,7 54,8 49,12 51,18 46,14 41,18 43,12 38,8 44,7" />
                                    </g>
                                </svg>
                                <p
                                    style={{
                                        color: '#00ff66',
                                        margin: '2px 0 0 0',
                                        fontSize: '10px',
                                        letterSpacing: '1px',
                                        fontWeight: 'bold',
                                    }}
                                >
                                    ENERGY STAR
                                </p>
                                <p
                                    style={{
                                        color: '#00cc55',
                                        margin: 0,
                                        fontSize: '7.5px',
                                        letterSpacing: '0.4px',
                                        opacity: 0.9,
                                    }}
                                >
                                    EPA POLLUTION PREVENTER
                                </p>
                            </div>
                        </div>
                        <div style={styles.headerInfo}>
                            <p style={{ margin: 0, color: '#e0e0e0' }}>
                                Award Modular BIOS v4.51PG, An Energy Star Ally
                            </p>
                            <p style={{ margin: 0, color: '#8da48d' }}>
                                Copyright (C) 1984-1998, Award Software, Inc.
                            </p>
                        </div>
                    </div>

                    <div style={styles.body} className="loading-screen-body">
                        <p style={{ margin: 0, color: '#ffffff' }}>PENTIUM(R) II MMX CPU at 450MHz</p>
                        <div style={styles.spacer} />
                        {showBiosInfo && (
                            <>
                                <p style={{ margin: '2px 0', color: '#c8dcc8' }}>
                                    Memory Test : {memoryKb}K{' '}
                                    {memoryKb >= 65536 ? (
                                        <span style={{ color: '#00ff66' }}>OK</span>
                                    ) : (
                                        <span className="blinking-cursor" />
                                    )}
                                </p>
                                <p style={{ margin: '2px 0', color: '#8da48d' }}>
                                    Award Plug and Play BIOS Extension v1.0A
                                </p>
                                <p style={{ margin: '2px 0', color: '#8da48d' }}>
                                    Detecting Primary Master   ... QUANTUM FIREBALL 8.4GB UDMA
                                </p>
                                <p style={{ margin: '2px 0', color: '#8da48d' }}>
                                    Detecting Primary Slave    ... NONE
                                </p>
                                <p style={{ margin: '2px 0', color: '#8da48d' }}>
                                    Detecting Secondary Master ... ATAPI CD-ROM 32X MAX
                                </p>
                                <p style={{ margin: '2px 0', color: '#8da48d' }}>
                                    Detecting Secondary Slave  ... NONE
                                </p>
                                <p style={{ margin: '2px 0', color: '#8da48d' }}>
                                    3D Raster Pipeline         ... Three.js WebGL2 Accelerated{' '}
                                    <span style={{ color: '#00ff66' }}>[OK]</span>
                                </p>
                                <p style={{ margin: '2px 0', color: '#8da48d' }}>
                                    Audio Synthesizer Engine   ... 16-Bit Stereo AudioContext{' '}
                                    <span style={{ color: '#00ff66' }}>[OK]</span>
                                </p>
                                <div style={styles.spacer} />
                                {showLoadingResources ? (
                                    progress >= 1 ? (
                                        <p
                                            className="bios-highlight"
                                            style={{ fontWeight: 'bold', margin: '4px 0' }}
                                        >
                                            SYSTEM READY — ALL SUBSYSTEMS NOMINAL
                                        </p>
                                    ) : (
                                        <p style={{ margin: '4px 0', color: '#8da48d' }}>
                                            Mounting Workstation Subsystems ({loaded}/{toLoad || 19}) ...
                                        </p>
                                    )
                                ) : (
                                    <p style={{ margin: '4px 0', color: '#8da48d' }}>
                                        Initializing hardware devices ...
                                    </p>
                                )}
                                <div className="retro-progress-bar">{renderProgressBar()}</div>
                            </>
                        )}
                        <div style={styles.spacer} />
                        <div style={styles.resourcesLoadingList}>
                            {resources.map((sourceName, idx) => (
                                <p
                                    key={idx}
                                    style={{ margin: '2px 0', color: '#7fa47f', fontSize: '13px' }}
                                >
                                    {sourceName}
                                </p>
                            ))}
                        </div>
                        <div style={styles.spacer} />
                        {showLoadingResources && doneLoading && (
                            <p
                                className="bios-highlight"
                                style={{ margin: '6px 0', fontWeight: 'bold' }}
                            >
                                BOOTING WORKSTATION ENVIRONMENT...
                            </p>
                        )}
                        <div style={styles.spacer} />
                        <span className="blinking-cursor" />
                    </div>

                    <div style={styles.footer} className="loading-screen-footer">
                        <p style={{ margin: 0, color: '#8da48d' }}>
                            AUTO-BOOT ENGAGED • <span style={{ color: '#00ff66' }}>SYS_READY</span> • PRESS ANY KEY TO SKIP
                        </p>
                        <p style={{ margin: 0, color: '#8da48d' }}>{getCurrentDate()}</p>
                    </div>
                </div>
            )}

            {webGLError && (
                <div
                    style={Object.assign({}, styles.popupContainer, {
                        opacity: webGLErrorOpacity,
                    })}
                >
                    <div style={styles.errorPopup}>
                        <p>
                            <b style={{ color: '#ff3333' }}>CRITICAL ERROR:</b> No WebGL Detected
                        </p>
                        <div style={styles.spacer} />
                        <p style={{ color: '#cccccc' }}>WebGL is required to run this 3D experience.</p>
                        <p style={{ color: '#888888' }}>
                            Please enable hardware acceleration or switch to a compatible browser.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles: StyleSheetCSS = {
    overlay: {
        backgroundColor: '#050805',
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'absolute',
        top: 0,
        left: 0,
        transition: 'opacity 0.85s cubic-bezier(0.25, 1, 0.5, 1), transform 1.2s cubic-bezier(0.25, 1, 0.5, 1)',
        MozTransition: 'opacity 0.85s cubic-bezier(0.25, 1, 0.5, 1), transform 1.2s cubic-bezier(0.25, 1, 0.5, 1)',
        WebkitTransition: 'opacity 0.85s cubic-bezier(0.25, 1, 0.5, 1), transform 1.2s cubic-bezier(0.25, 1, 0.5, 1)',
        boxSizing: 'border-box',
        fontSize: 15,
        letterSpacing: 0.8,
        overflow: 'hidden',
        zIndex: 1000,
    },
    spacer: {
        height: 12,
    },
    header: {
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
    },
    popupContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20,
    },
    errorPopup: {
        backgroundColor: '#000',
        padding: 24,
        border: '3px solid #ff3333',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        maxWidth: 500,
    },
    headerInfo: {
        marginLeft: 24,
    },
    overlayText: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        zIndex: 2,
    },
    body: {
        flex: 1,
        display: 'flex',
        width: '100%',
        boxSizing: 'border-box',
        flexDirection: 'column',
    },
    logoContainer: {
        display: 'flex',
        flexDirection: 'row',
    },
    resourcesLoadingList: {
        display: 'flex',
        paddingLeft: 16,
        paddingBottom: 8,
        flexDirection: 'column',
    },
    footer: {
        boxSizing: 'border-box',
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
    },
};

export default LoadingScreen;
