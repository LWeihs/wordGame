export default function disableSubmitAllForms() {
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', e => {
            e.preventDefault();
        });
    });
}