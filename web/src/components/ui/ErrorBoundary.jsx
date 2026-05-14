import React from 'react';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 max-w-4xl mx-auto mt-10 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
                    <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Something went wrong.</h2>
                    <div className="bg-white dark:bg-neutral-900 p-4 rounded-xl overflow-x-auto text-sm font-mono text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-800">
                        <p className="font-bold mb-2">{this.state.error && this.state.error.toString()}</p>
                        <pre className="whitespace-pre-wrap">{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
