export default function scaleViewportUnits () {
    const appHeight = () => {
        const doc = document.documentElement;
        doc.style.setProperty('--app-height', `${window.innerHeight}px`)
    };
    const appWidth = () => {
        const doc = document.documentElement;
        doc.style.setProperty('--app-width', `${window.innerWidth}px`);
    };
    const appDimensions = () => {
        appHeight();
        appWidth();
    };
    window.addEventListener('resize', appDimensions);
    appDimensions();
}
