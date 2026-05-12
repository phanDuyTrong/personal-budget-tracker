export const viFilter = (textValue, inputValue) => {
    if (!inputValue) return true;
    
    const normalize = (str) => str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase();
        
    return normalize(textValue).includes(normalize(inputValue));
};
