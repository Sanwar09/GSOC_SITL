import pathway as pw
from pathway.xpacks.llm.vector_store import VectorStoreServer
from pathway.xpacks.llm.parsers import ParseUnstructured
from pathway.xpacks.llm.embedders import SentenceTransformerEmbedder

# 1. THE WATCHER
data_sources = [
    pw.io.fs.read(
        "./oni_workspace",
        format="binary",
        mode="streaming",
        with_metadata=True,
    )
]

# 2. THE SERVER
def run_pathway_server():
    print("🧠 PATHWAY BRAIN ACTIVATED: Watching ./oni_workspace")
    print("⏳ Loading Embedding Model (This takes 10s the first time)...")
    
    local_embedder = SentenceTransformerEmbedder(model="all-MiniLM-L6-v2")

    server = VectorStoreServer(
        *data_sources,
        embedder=local_embedder,
        parser=ParseUnstructured()
    )
    
    # <--- FIX IS HERE: Changed .run() to .run_server()
    server.run_server(
        host="127.0.0.1", 
        port=8000,
        with_cache=False
    )

if __name__ == "__main__":
    run_pathway_server()