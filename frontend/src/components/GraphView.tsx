import React from 'react';
import Plot from 'react-plotly.js';
import { PlotData } from '../types';

interface GraphViewProps {
    data: PlotData | null;
    loading: boolean;
}

export const GraphView: React.FC<GraphViewProps> = ({ data, loading }) => {
    if (loading) {
        return (
            <div className="flex items-center justify-center h-full w-full bg-brand-surface rounded-xl border border-brand-muted/20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent"></div>
            </div>
        );
    }

    if (!data || data.error) {
        return (
            <div className="flex flex-col items-center justify-center h-full w-full bg-brand-surface rounded-xl border border-brand-muted/20 text-brand-muted p-6 text-center">
                <svg className="w-16 h-16 mb-4 text-brand-muted/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <p className="text-lg font-medium">{data?.error || "Enter a graphable equation (e.g., y = x^2) to see visualization"}</p>
            </div>
        );
    }

    const plotDataList: any = [
        data.type === '2d'
            ? {
                x: data.x,
                y: data.y,
                type: 'scatter',
                mode: 'lines',
                marker: { color: '#3b82f6' },
                line: { width: 3, shape: 'spline' }
            }
            : {
                x: data.x,
                y: data.y,
                z: data.z,
                type: 'surface',
                colorscale: 'Viridis'
            }
    ];

    return (
        <div className="h-full w-full bg-brand-surface rounded-xl border border-brand-muted/20 overflow-hidden shadow-lg">
            <Plot
                data={plotDataList}
                layout={{
                    autosize: true,
                    paper_bgcolor: 'transparent',
                    plot_bgcolor: 'transparent',
                    font: { color: '#f8fafc', family: 'Inter, sans-serif' },
                    margin: { l: 50, r: 30, t: 30, b: 50 },
                    xaxis: { title: { text: data.xaxis_title || 'x' } as any, gridcolor: '#334155', zerolinecolor: '#475569' },
                    yaxis: { title: { text: data.yaxis_title || 'y' } as any, gridcolor: '#334155', zerolinecolor: '#475569' },
                    scene: data.type === '3d' ? {
                        xaxis: { title: { text: data.xaxis_title || 'x' } as any, backgroundcolor: 'transparent', gridcolor: '#334155' },
                        yaxis: { title: { text: data.yaxis_title || 'y' } as any, backgroundcolor: 'transparent', gridcolor: '#334155' },
                        zaxis: { title: { text: data.zaxis_title || 'z' } as any, backgroundcolor: 'transparent', gridcolor: '#334155' },
                    } as any : undefined
                }}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ responsive: true, displayModeBar: false }}
            />
        </div>
    );
};
