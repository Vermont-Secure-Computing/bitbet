import React from "react";

export const renderPagination = (currentPage, totalPages, setCurrentPage) => {
    const pages = [];
  
    // Show all pages if total is 5 or less
    if (totalPages <= 5) {
        for (let i = 1; i <= totalPages; i++) {
            pages.push(i);
        }
    } else {
        // Always show the first page
        pages.push(1);
    
        // Show ... if current page is after 3
        if (currentPage > 3) {
            pages.push("...");
        }
    
        // Show pages around the current page
        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
    
        // Show ... if current page is before totalPages - 2
        if (currentPage < totalPages - 2) {
            pages.push("...");
        }
    
        // Always show the last page
        pages.push(totalPages);
    }
  
    return (
        <div className="flex flex-wrap justify-center gap-2 mt-6">
            <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`px-2 py-1 !text-xs rounded-lg transition-all duration-200
                    ${currentPage === 1 ? '!bg-gray-600 text-white cursor-not-allowed' : '!bg-blue-600 text-white hover:!bg-blue-700 hover:scale-105'}`}
            >
                Previous
            </button>
    
            {pages.map((page, index) => (
                <button
                    key={index}
                    onClick={() => typeof page === 'number' && setCurrentPage(page)}
                    disabled={page === "..."}
                    className={`px-2 py-1 !text-xs rounded-lg transition-all duration-200
                    ${page === currentPage ? '!bg-blue-500 text-white' : page === "..." ? 'text-gray-400 cursor-default' : '!bg-gray-700 text-white hover:!bg-blue-600 hover:scale-105'}`}
                >
                    {page}
                </button>
            ))}
    
            <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={`px-2 py-1 !text-xs rounded-lg transition-all duration-200
                    ${currentPage === totalPages ? '!bg-gray-600 text-white cursor-not-allowed' : '!bg-blue-600 text-white hover:!bg-blue-700 hover:scale-105'}`}
            >
                Next
            </button>
        </div>
    );
};
  